// ──────────────────────────────────────────────────────────────────────────
// Back-office login journal.
//
// Every project signs its admins in through its own route (`/auth/email`,
// `/auth`, …) with its own token payload, so the leaf does not own the login.
// It watches it instead: the back-office tags its login request with
// `?via=backoffice`, and this middleware reads the answer the route sends —
// a token means it worked, anything else is the reason it did not.
//
// A token is not enough to call it a back-office login: the account must also
// pass `canAccessAdmin`, or an app user with a valid password would show up
// as an admin. Routes listed in `routes` are watched without the tag, so a
// script hitting the login directly still leaves a trace when it gets in.
//
// Logging never blocks or breaks the login: it runs after the response is
// handed over, and a failure only prints.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'
import type { Request, Response, NextFunction } from 'express'
import { AdminLoginLog } from '../models/AdminLoginLog.js'

export interface LoginJournalConfig {
    /** Login routes watched even when the request is not tagged by the back-office. */
    routes?: string[]
    /** Collection the `user_id` column links to. Default `users`. */
    usersCollection?: string
    /** Field of that collection shown for the user. Default `email`. */
    usersDisplayField?: string
    /** Sequelize model the user ids belong to, joined so the list names the account. Default `User`. */
    userModel?: string
}

export const LOGIN_JOURNAL_COLLECTION = 'admin-logins'

export function loginJournalOptions(value: boolean | LoginJournalConfig | undefined): LoginJournalConfig | null {
    if (!value) return null
    return value === true ? {} : value
}

const IDENTIFIER_KEYS = ['email', 'username', 'login', 'phone', 'identifier']

function identifierOf(body: any): string | null {
    if (!body || typeof body !== 'object') return null
    for (const key of IDENTIFIER_KEYS) {
        const value = body[key]
        if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase().slice(0, 255)
    }
    return null
}

function ipOf(req: Request): string | null {
    const forwarded = req.headers['x-forwarded-for']
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
    const ip = first || req.ip || req.socket?.remoteAddress || ''
    return ip.replace(/^::ffff:/, '') || null
}

/** "Chrome 141 on macOS" — enough to recognise a session, not a full parser. */
export function describeClient(ua: string | undefined): string | null {
    if (!ua) return null
    const browser =
        (/Edg\/(\d+)/.exec(ua) && `Edge ${/Edg\/(\d+)/.exec(ua)![1]}`) ||
        (/OPR\/(\d+)/.exec(ua) && `Opera ${/OPR\/(\d+)/.exec(ua)![1]}`) ||
        (/Firefox\/(\d+)/.exec(ua) && `Firefox ${/Firefox\/(\d+)/.exec(ua)![1]}`) ||
        (/Chrome\/(\d+)/.exec(ua) && `Chrome ${/Chrome\/(\d+)/.exec(ua)![1]}`) ||
        (/Version\/(\d+)[\d.]* .*Safari/.exec(ua) && `Safari ${/Version\/(\d+)/.exec(ua)![1]}`) ||
        (/curl|PostmanRuntime|axios|node-fetch|python-requests|okhttp/i.exec(ua)?.[0] ?? null)
    const os =
        (/iPhone|iPad/.test(ua) && 'iOS') ||
        (/Android/.test(ua) && 'Android') ||
        (/Mac OS X|Macintosh/.test(ua) && 'macOS') ||
        (/Windows/.test(ua) && 'Windows') ||
        (/Linux/.test(ua) && 'Linux') ||
        null
    if (browser && os) return `${browser} on ${os}`
    return browser || os || ua.slice(0, 60)
}

function tokenOf(body: any): string | null {
    const token = body?.data?.token ?? body?.token
    return typeof token === 'string' && token ? token : null
}

function reasonOf(status: number, body: any): string {
    const error = Array.isArray(body?.errors) ? body.errors[0] : body?.error ?? body?.message
    const text = typeof error === 'string' ? error : error?.message
    return String(text || `HTTP ${status}`).slice(0, 255)
}

/** What the request said, read while it is still connected: the socket's address is gone once the answer is sent. */
interface Attempt {
    identifier: string | null
    ip: string | null
    userAgent: string | undefined
}

async function record(attempt: Attempt, status: number, body: any, tagged: boolean): Promise<void> {
    const adminLeaf = (etherial as any).eth_admin_leaf
    const httpAuth = (etherial as any).http_auth
    const token = status < 400 && !(body?.status >= 400) ? tokenOf(body) : null

    let userId: number | null = null
    let success = false
    let reason: string | null = null

    if (token) {
        const user = httpAuth?.userFromToken ? await httpAuth.userFromToken(token) : null
        const hasAccess = user ? await adminLeaf?.canAccessAdmin(user).catch(() => false) : false
        // An app user signing in through a watched route is not a back-office login.
        if (!hasAccess && !tagged) return
        userId = user?.id ?? null
        success = !!hasAccess
        reason = hasAccess ? null : 'no_admin_access'
    } else {
        // Untagged failures on a shared login route are app users mistyping a code.
        if (!tagged) return
        reason = reasonOf(status, body)
    }

    const ua = attempt.userAgent
    await AdminLoginLog.create({
        user_id: userId,
        identifier: attempt.identifier,
        success,
        reason,
        ip: attempt.ip,
        client: describeClient(ua),
        user_agent: ua ? ua.slice(0, 1000) : null,
    } as any)
}

export function loginJournalMiddleware(config: LoginJournalConfig) {
    const routes = new Set(config.routes ?? [])

    return (req: Request, res: Response, next: NextFunction) => {
        if (req.method !== 'POST') return next()
        const tagged = req.query?.via === 'backoffice'
        if (!tagged && !routes.has(req.path)) return next()

        const send = res.json.bind(res)
        let done = false
        res.json = (body: any) => {
            if (!done) {
                done = true
                const status = res.statusCode
                const attempt: Attempt = {
                    identifier: identifierOf(req.body),
                    ip: ipOf(req),
                    userAgent: req.headers['user-agent'],
                }
                setImmediate(() => {
                    record(attempt, status, body, tagged).catch((err) =>
                        console.error('[ETHAdminLeaf] Login journal:', err?.message || err)
                    )
                })
            }
            return send(body)
        }
        next()
    }
}

/**
 * Joins each row to its account when the project has a user model, so the list
 * names the person instead of looking the id up in a page of users. No
 * constraint: the table must not depend on the project's.
 */
export function linkLoginJournalToUsers(config: LoginJournalConfig): boolean {
    const models = (etherial as any).database?.sequelize?.models ?? {}
    const User = models[config.userModel ?? 'User']
    if (!User) return false
    if (!(AdminLoginLog as any).associations?.user) {
        AdminLoginLog.belongsTo(User, { foreignKey: 'user_id', as: 'user', constraints: false })
    }
    return true
}

/** The read-only collection the back-office lists the journal with. */
export function loginJournalCollection(config: LoginJournalConfig, hasUsers: boolean, linked: boolean) {
    const usersCollection = config.usersCollection ?? 'users'
    const displayField = config.usersDisplayField ?? 'email'
    const include = linked ? [{ association: 'user', attributes: ['id', displayField] }] : []
    return {
        name: LOGIN_JOURNAL_COLLECTION,
        model: AdminLoginLog,
        crud: ['list', 'show'] as ('list' | 'show')[],
        exportable: true,
        meta: {
            label: 'Login',
            labelPlural: 'Back-office logins',
            icon: 'LogIn',
            description: 'Every sign-in to the back-office, successful or not',
            group: 'System',
            order: 95,
        },
        fields: [
            { name: 'id', type: 'integer' as const, readonly: true, sortable: true },
            {
                name: 'success',
                type: 'select' as const,
                label: 'Result',
                filterable: true,
                options: [
                    { value: 'true', label: 'Signed in', color: 'green' },
                    { value: 'false', label: 'Refused', color: 'red' },
                ],
            },
            { name: 'identifier', type: 'string' as const, label: 'Login', searchable: true, sortable: true },
            hasUsers
                ? {
                      name: 'user_id',
                      type: 'relation' as const,
                      label: 'Account',
                      filterable: true,
                      relation: { collection: usersCollection, displayField },
                  }
                : { name: 'user_id', type: 'integer' as const, label: 'Account', filterable: true },
            { name: 'reason', type: 'string' as const, label: 'Reason', filterable: true },
            { name: 'ip', type: 'string' as const, label: 'IP address', searchable: true, filterable: true },
            { name: 'client', type: 'string' as const, label: 'Browser' },
            { name: 'user_agent', type: 'text' as const, label: 'User agent', readonly: true },
            { name: 'created_at', type: 'datetime' as const, label: 'Date', readonly: true, sortable: true, filterable: true },
        ],
        views: {
            list: {
                fields: ['success', 'identifier', 'user_id', 'reason', 'ip', 'client', 'created_at'],
                sort: { field: 'created_at', direction: 'desc' as const },
                search: ['identifier', 'ip'],
                filters: ['success', 'reason', 'user_id', 'created_at'],
                include,
            },
            show: {
                layout: 'sections' as const,
                sections: [
                    { title: 'Attempt', fields: ['success', 'reason', 'identifier', 'user_id', 'created_at'] },
                    { title: 'Origin', fields: ['ip', 'client', 'user_agent'] },
                ],
                include,
            },
        },
    }
}
