import * as FileRequestForm from '../forms/file_request_form';
interface FileRequestRouteParams {
    allowCustomFilename?: boolean;
    shouldBePrivate?: boolean;
    authorizedFolders?: string[];
}
export declare const FileRequestRoute: ({ allowCustomFilename, shouldBePrivate, authorizedFolders }?: FileRequestRouteParams) => (req: {
    form: FileRequestForm.Create;
}, res: any, next: any) => Promise<any>;
export {};
