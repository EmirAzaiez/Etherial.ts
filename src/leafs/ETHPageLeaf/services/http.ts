import etherial from 'etherial'
import type { Request, Response } from 'express'

import { COLLECTION, PageError, defaultLocaleOf, languageOf } from './options.js'
import { state } from './state.js'

export type AuthedRequest = Request & { user: any }

/** The app's language: `?locale=`, then the app's header, then the phone's. */
export function localeOf(req: Request): string {
    return (
        languageOf(req.query?.locale) ??
        languageOf(req.headers['x-app-locale']) ??
        languageOf(req.headers['accept-language']) ??
        defaultLocaleOf(state.config)
    )
}

/** A back-office route, once the admin leaf allows it: by default, to whoever may read the pages. */
export async function guard(
    req: AuthedRequest,
    res: Response,
    run: () => Promise<any>,
    may: (adminLeaf: any) => Promise<boolean> = (adminLeaf) => adminLeaf.checkAccess(req.user, COLLECTION, 'list')
) {
    const adminLeaf = (etherial as any).eth_admin_leaf
    const allowed = !!adminLeaf && (await adminLeaf.canAccessAdmin(req.user)) && (await may(adminLeaf))
    if (!allowed) return (res as any).error({ status: 403, errors: ['forbidden'] })
    try {
        return (res as any).success({ status: 200, data: await run() })
    } catch (err: any) {
        if (err instanceof PageError) return (res as any).error({ status: err.status, errors: [err.message], message: err.message })
        console.error('[ETHPageLeaf] Admin route failed:', err)
        return (res as any).error({ status: 500, errors: ['server_error'] })
    }
}

/**
 * A back-office route that answers as it goes, in server-sent events (`event:
 * <name>` / `data: <json>`): `run` sends them. A failure before the first one
 * is answered like `guard`'s; after it, as an `error` event. The run is
 * stopped (`signal`) when the back-office goes away.
 */
export async function streamed(
    req: AuthedRequest,
    res: Response,
    run: (send: (event: string, data: unknown) => void, signal: AbortSignal) => Promise<void>
) {
    const adminLeaf = (etherial as any).eth_admin_leaf
    if (!adminLeaf || !(await adminLeaf.canAccessAdmin(req.user))) return (res as any).error({ status: 403, errors: ['forbidden'] })

    const controller = new AbortController()
    res.on('close', () => {
        if (!res.writableFinished) controller.abort()
    })
    let ping: ReturnType<typeof setInterval> | undefined
    const send = (event: string, data: unknown) => {
        if (controller.signal.aborted) return
        if (!res.headersSent) {
            res.status(200)
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
            res.setHeader('Cache-Control', 'no-cache, no-transform')
            res.setHeader('X-Accel-Buffering', 'no')
            res.flushHeaders()
            // A proxy closes a connection that says nothing for a while: Claude can think for some time.
            ping = setInterval(() => res.write(': ping\n\n'), 10_000)
        }
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    try {
        await run(send, controller.signal)
    } catch (err: any) {
        if (controller.signal.aborted) return
        const known = err instanceof PageError
        if (!known) console.error('[ETHPageLeaf] Streamed route failed:', err)
        const status = known ? err.status : 500
        const message = known ? err.message : 'server_error'
        if (!res.headersSent) return (res as any).error({ status, errors: [message], message })
        send('error', { status, message })
    } finally {
        clearInterval(ping)
        if (res.headersSent && !res.writableEnded) res.end()
    }
}
