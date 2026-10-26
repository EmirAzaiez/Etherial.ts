import type { Request } from 'express';
/**
 * The app's language: `?locale=`, then the app's header, then the phone's,
 * among the languages the app gets. Else the default one.
 */
export declare function localeOf(req: Request): string;
/**
 * Whether the request comes from someone signed in: the project's own check,
 * else a token etherial's auth accepts (signature, expiry, its user).
 */
export declare function isSignedIn(req: Request): Promise<boolean>;
