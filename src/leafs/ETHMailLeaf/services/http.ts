import etherial from 'etherial'
import type { Request, Response } from 'express'

import { MailError } from './options.js'

export type AuthedRequest = Request & { user: any }

/**
 * Runs a back-office route once the admin leaf allows it: reading takes the
 * collection's `list` right, changing it the one named.
 */
export async function guard(req: AuthedRequest, res: Response, collection: string, method: 'list' | 'create' | 'update' | 'delete', run: () => Promise<any>) {
    const adminLeaf = (etherial as any).eth_admin_leaf
    const allowed = !!adminLeaf && (await adminLeaf.canAccessAdmin(req.user)) && (await adminLeaf.checkAccess(req.user, collection, method))
    if (!allowed) return (res as any).error({ status: 403, errors: ['forbidden'] })
    try {
        return (res as any).success({ status: 200, data: await run() })
    } catch (err: any) {
        if (err instanceof MailError) return (res as any).error({ status: err.status, errors: [err.code], message: err.message })
        console.error('[ETHMailLeaf] Admin route failed:', err)
        return (res as any).error({ status: 500, errors: ['server_error'] })
    }
}

/** The address the back-office reached the API at: `https://api.example.com`. HTTPS unless it is this machine. */
export function originOf(req: Request): string | null {
    const host = req.get('x-forwarded-host')?.split(',')[0].trim() || req.get('host')
    if (!host || !/^[a-z0-9.\-:[\]]+$/i.test(host)) return null
    const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)
    return `${local ? req.protocol : 'https'}://${host}`
}
