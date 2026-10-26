import etherial from 'etherial'
import type { Request } from 'express'

import { languageOf } from './options.js'
import { languages, state } from './state.js'

/**
 * The app's language: `?locale=`, then the app's header, then the phone's,
 * among the languages the app gets. Else the default one.
 */
export function localeOf(req: Request): string {
    const { app, default: fallback } = languages()
    const asked = [req.query?.locale, req.headers['x-app-locale'], req.headers['accept-language']].map(languageOf)
    return asked.find((l): l is string => !!l && app.includes(l)) ?? fallback
}

/**
 * Whether the request comes from someone signed in: the project's own check,
 * else a token etherial's auth accepts (signature, expiry, its user).
 */
export async function isSignedIn(req: Request): Promise<boolean> {
    try {
        if (state.config.signedIn) return !!(await state.config.signedIn(req))
        const header = req.headers.authorization
        const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : ''
        if (!token) return false
        return !!(await (etherial as any).http_auth?.userFromToken?.(token))
    } catch {
        return false
    }
}
