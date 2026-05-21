/**
 * In-process cache for Apple's JWKS. Keys rotate but rarely — refreshing every
 * 10 minutes is plenty, and on a verification failure we force a re-fetch in
 * case Apple just rotated.
 */
interface JWK {
    kty: string;
    kid: string;
    use?: string;
    alg?: string;
    n: string;
    e: string;
}
export interface VerifiedAppleToken {
    sub: string;
    email?: string;
    email_verified?: boolean | string;
    is_private_email?: boolean | string;
    aud: string;
    iss: string;
    exp: number;
    iat: number;
    nonce?: string;
}
export interface VerifyAppleOptions {
    /**
     * The Apple `aud` value(s) accepted: your Service ID (web/Sign-in-with-Apple-JS)
     * or your iOS app's bundle identifier (native Sign in with Apple).
     * REQUIRED — refusing to verify when this is empty avoids accidentally accepting
     * tokens issued for an unrelated Apple client.
     */
    audience: string | string[];
    /**
     * Optional nonce captured at sign-in start to bind the token to the session.
     */
    nonce?: string;
    /**
     * Test seam — defaults to fetching from Apple's JWKS endpoint.
     */
    fetchKeys?: (force: boolean) => Promise<Map<string, JWK>>;
}
/**
 * Verify an Apple identity token. Returns the decoded payload on success.
 * Throws on any verification failure — callers MUST treat a thrown error as
 * "reject the request, do NOT trust any claim in the token".
 */
export declare function verifyAppleIdentityToken(token: string, options: VerifyAppleOptions): Promise<VerifiedAppleToken>;
export {};
