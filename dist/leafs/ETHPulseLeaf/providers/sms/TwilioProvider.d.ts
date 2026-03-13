import { ISmsProvider, SmsResult, SmsOptions } from './ISmsProvider.js';
export interface TwilioConfig {
    accountSid: string;
    authToken: string;
    fromNumber: string;
}
export declare class TwilioProvider implements ISmsProvider {
    readonly name = "twilio";
    private client;
    private fromNumber;
    constructor(config: TwilioConfig);
    send(params: {
        phone: string;
        message: string;
    }): Promise<SmsResult>;
    sendBulk(recipients: string[], message: string): Promise<SmsResult[]>;
    sendWithOptions(options: SmsOptions): Promise<SmsResult>;
}
