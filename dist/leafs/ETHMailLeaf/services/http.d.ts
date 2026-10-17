import type { Request, Response } from 'express';
export type AuthedRequest = Request & {
    user: any;
};
/**
 * Runs a back-office route once the admin leaf allows it: reading takes the
 * collection's `list` right, changing it the one named.
 */
export declare function guard(req: AuthedRequest, res: Response, collection: string, method: 'list' | 'create' | 'update' | 'delete', run: () => Promise<any>): Promise<any>;
/** The address the back-office reached the API at: `https://api.example.com`. HTTPS unless it is this machine. */
export declare function originOf(req: Request): string | null;
