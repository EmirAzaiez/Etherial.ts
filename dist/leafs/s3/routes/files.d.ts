import type { RequestHandler } from 'express';
interface FileRequestRouteParams {
    allowCustomFilename?: boolean;
    shouldBePrivate?: boolean;
    authorizedFolders?: string[];
}
export declare const FileRequestRoute: ({ allowCustomFilename, shouldBePrivate, authorizedFolders }?: FileRequestRouteParams) => RequestHandler;
export {};
