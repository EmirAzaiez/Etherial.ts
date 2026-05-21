var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
/**
 * Apple's public JWKS endpoint.
 */
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';
let jwksCache = null;
const JWKS_TTL_MS = 10 * 60 * 1000;
function fetchAppleJWKS() {
    return __awaiter(this, arguments, void 0, function* (force = false) {
        const now = Date.now();
        if (!force && jwksCache && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
            return jwksCache.keys;
        }
        const res = yield fetch(APPLE_JWKS_URL);
        if (!res.ok) {
            throw new Error(`Apple JWKS fetch failed: ${res.status} ${res.statusText}`);
        }
        const body = yield res.json();
        const map = new Map();
        for (const key of body.keys) {
            if (key.kid) {
                map.set(key.kid, key);
            }
        }
        jwksCache = { fetchedAt: now, keys: map };
        return map;
    });
}
function jwkToPem(jwk) {
    // Node 22 supports `format: 'jwk'` in createPublicKey. We then export to PEM
    // so jsonwebtoken's verify can consume a regular string key.
    const keyObject = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    return keyObject.export({ type: 'spki', format: 'pem' }).toString();
}
/**
 * Verify an Apple identity token. Returns the decoded payload on success.
 * Throws on any verification failure — callers MUST treat a thrown error as
 * "reject the request, do NOT trust any claim in the token".
 */
export function verifyAppleIdentityToken(token, options) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!token || typeof token !== 'string') {
            throw new Error('Apple token missing or not a string');
        }
        const audience = options.audience;
        if (!audience || (Array.isArray(audience) && audience.length === 0)) {
            throw new Error('verifyAppleIdentityToken: `audience` is required. Set it to your Apple Service ID ' +
                '(web) or your app bundle identifier (native).');
        }
        // Inspect the header to find the right key without trusting the payload.
        const decoded = jwt.decode(token, { complete: true });
        if (!decoded || typeof decoded === 'string') {
            throw new Error('Apple token is malformed');
        }
        const { kid, alg } = decoded.header;
        if (!kid) {
            throw new Error('Apple token header missing kid');
        }
        // Apple uses RS256; pin it to defend against alg=none / HS256 confusion.
        if (alg !== 'RS256') {
            throw new Error(`Unexpected alg in Apple token: ${alg}`);
        }
        const fetchKeys = (_a = options.fetchKeys) !== null && _a !== void 0 ? _a : fetchAppleJWKS;
        let keys = yield fetchKeys(false);
        let jwk = keys.get(kid);
        if (!jwk) {
            // Apple may have rotated since we cached — force a refresh once.
            keys = yield fetchKeys(true);
            jwk = keys.get(kid);
        }
        if (!jwk) {
            throw new Error(`Apple JWKS has no key for kid=${kid}`);
        }
        const pem = jwkToPem(jwk);
        const audienceForVerify = Array.isArray(audience)
            ? (audience.length === 1 ? audience[0] : audience)
            : audience;
        const payload = jwt.verify(token, pem, {
            algorithms: ['RS256'],
            issuer: APPLE_ISSUER,
            audience: audienceForVerify,
        });
        if (options.nonce !== undefined && payload.nonce !== options.nonce) {
            throw new Error('Apple token nonce mismatch');
        }
        if (!payload.sub) {
            throw new Error('Apple token has no sub claim');
        }
        return payload;
    });
}
