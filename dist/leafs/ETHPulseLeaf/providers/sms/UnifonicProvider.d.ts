import { ISmsProvider, SmsResult, SmsOptions } from './ISmsProvider.js';
export interface UnifonicConfig {
    appSid: string;
    senderId: string;
}
export declare class UnifonicProvider implements ISmsProvider {
    readonly name = "unifonic";
    private appSid;
    private senderId;
    private baseUrl;
    constructor(config: UnifonicConfig);
    send(params: {
        phone: string;
        message: string;
    }): Promise<SmsResult>;
    sendBulk(recipients: string[], message: string): Promise<SmsResult[]>;
    sendWithOptions(options: SmsOptions): Promise<SmsResult>;
}
