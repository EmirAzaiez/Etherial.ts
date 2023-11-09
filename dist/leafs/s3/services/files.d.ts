import * as FileRequestForm from "../forms/file_request_form";
interface Props {
    form: FileRequestForm.Create;
}
export declare const getFileAccessForPut: ({ form }: Props) => {
    url: any;
    filename: string;
    extension: any;
    path: string;
    public_url: string;
};
export {};
