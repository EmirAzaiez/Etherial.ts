import type { Request, Response } from 'express';
export type AuthedRequest = Request & {
    user: any;
};
/** The app's language: `?locale=`, then the app's header, then the phone's. */
export declare function localeOf(req: Request): string;
/** A back-office route, once the admin leaf allows it: by default, to whoever may read the pages. */
export declare function guard(req: AuthedRequest, res: Response, run: () => Promise<any>, may?: (adminLeaf: any) => Promise<boolean>): Promise<any>;
/**
 * A back-office route that answers as it goes, in server-sent events (`event:
 * <name>` / `data: <json>`): `run` sends them. A failure before the first one
 * is answered like `guard`'s; after it, as an `error` event. The run is
 * stopped (`signal`) when the back-office goes away.
 */
export declare function streamed(req: AuthedRequest, res: Response, run: (send: (event: string, data: unknown) => void, signal: AbortSignal) => Promise<void>): Promise<any>;
