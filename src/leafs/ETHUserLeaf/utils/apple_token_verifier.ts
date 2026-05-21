import * as jwt from 'jsonwebtoken'
import * as crypto from 'crypto'

/**
 * Apple's public JWKS endpoint.
 */
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys'
const APPLE_ISSUER = 'https://appleid.apple.com'

/**
 * In-process cache for Apple's JWKS. Keys rotate but rarely — refreshing every
 * 10 minutes is plenty, and on a verification failure we force a re-fetch in
 * case Apple just rotated.
 */
interface JWK {
    kty: string
    kid: string
    use?: string
    alg?: string
    n: string
    e: string
}

interface JWKSCache {
    fetchedAt: number
    keys: Map<string, JWK>
}

let jwksCache: JWKSCache | null = null
const JWKS_TTL_MS = 10 * 60 * 1000

async function fetchAppleJWKS(force = false): Promise<Map<string, JWK>> {
    const now = Date.now()
    if (!force && jwksCache && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
        return jwksCache.keys
    }

    const res = await fetch(APPLE_JWKS_URL)
    if (!res.ok) {
        throw new Error(`Apple JWKS fetch failed: ${res.status} ${res.statusText}`)
    }
    const body = await res.json() as { keys: JWK[] }
    const map = new Map<string, JWK>()
    for (const key of body.keys) {
        if (key.kid) {
            map.set(key.kid, key)
        }
    }

    jwksCache = { fetchedAt: now, keys: map }
    return map
}

function jwkToPem(jwk: JWK): string {
    // Node 22 supports `format: 'jwk'` in createPublicKey. We then export to PEM
    // so jsonwebtoken's verify can consume a regular string key.
    const keyObject = crypto.createPublicKey({ key: jwk as any, format: 'jwk' })
    return keyObject.export({ type: 'spki', format: 'pem' }).toString()
}

export interface VerifiedAppleToken {
    sub: string                 // stable Apple user id — the only trustworthy identity
    email?: string
    email_verified?: boolean | string
    is_private_email?: boolean | string
    aud: string
    iss: string
    exp: number
    iat: number
    nonce?: string
}

export interface VerifyAppleOptions {
    /**
     * The Apple `aud` value(s) accepted: your Service ID (web/Sign-in-with-Apple-JS)
     * or your iOS app's bundle identifier (native Sign in with Apple).
     * REQUIRED — refusing to verify when this is empty avoids accidentally accepting
     * tokens issued for an unrelated Apple client.
     */
    audience: string | string[]
    /**
     * Optional nonce captured at sign-in start to bind the token to the session.
     */
    nonce?: string
    /**
     * Test seam — defaults to fetching from Apple's JWKS endpoint.
     */
    fetchKeys?: (force: boolean) => Promise<Map<string, JWK>>
}

/**
 * Verify an Apple identity token. Returns the decoded payload on success.
 * Throws on any verification failure — callers MUST treat a thrown error as
 * "reject the request, do NOT trust any claim in the token".
 */
export async function verifyAppleIdentityToken(
    token: string,
    options: VerifyAppleOptions
): Promise<VerifiedAppleToken> {
    if (!token || typeof token !== 'string') {
        throw new Error('Apple token missing or not a string')
    }

    const audience = options.audience
    if (!audience || (Array.isArray(audience) && audience.length === 0)) {
        throw new Error(
            'verifyAppleIdentityToken: `audience` is required. Set it to your Apple Service ID ' +
            '(web) or your app bundle identifier (native).'
        )
    }

    // Inspect the header to find the right key without trusting the payload.
    const decoded = jwt.decode(token, { complete: true })
    if (!decoded || typeof decoded === 'string') {
        throw new Error('Apple token is malformed')
    }
    const { kid, alg } = decoded.header
    if (!kid) {
        throw new Error('Apple token header missing kid')
    }
    // Apple uses RS256; pin it to defend against alg=none / HS256 confusion.
    if (alg !== 'RS256') {
        throw new Error(`Unexpected alg in Apple token: ${alg}`)
    }

    const fetchKeys = options.fetchKeys ?? fetchAppleJWKS
    let keys = await fetchKeys(false)
    let jwk = keys.get(kid)
    if (!jwk) {
        // Apple may have rotated since we cached — force a refresh once.
        keys = await fetchKeys(true)
        jwk = keys.get(kid)
    }
    if (!jwk) {
        throw new Error(`Apple JWKS has no key for kid=${kid}`)
    }

    const pem = jwkToPem(jwk)

    const audienceForVerify = Array.isArray(audience)
        ? (audience.length === 1 ? audience[0] : (audience as [string, ...string[]]))
        : audience

    const payload = jwt.verify(token, pem, {
        algorithms: ['RS256'],
        issuer: APPLE_ISSUER,
        audience: audienceForVerify,
    }) as VerifiedAppleToken

    if (options.nonce !== undefined && payload.nonce !== options.nonce) {
        throw new Error('Apple token nonce mismatch')
    }

    if (!payload.sub) {
        throw new Error('Apple token has no sub claim')
    }

    return payload
}
