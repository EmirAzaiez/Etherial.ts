import * as FileRequestForm from '../forms/file_request_form';
export declare const FileRequestRoute: () => (req: {
    form: FileRequestForm.Create;
}, res: any, next: any) => Promise<void>;
