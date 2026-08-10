import { ISmsProvider, SmsResult, SmsOptions } from './ISmsProvider.js';
export interface SaudiAlertConfig {
    username: string;
    apiPassword: string;
    sender: string;
    /** Delivery priority passed to the gateway. Defaults to '8'. */
    priority?: string;
}
/**
 * Saudi Alert SMS provider (saudialert.com).
 *
 * Simple HTTP GET gateway, KSA numbers only: the recipient is normalised to
 * the 12-digit `966XXXXXXXXX` form before being sent.
 */
export declare class SaudiAlertProvider implements ISmsProvider {
    readonly name = "saudialert";
    private username;
    private apiPassword;
    private sender;
    private priority;
    private baseUrl;
    constructor(config: SaudiAlertConfig);
    private formatNumber;
    send(params: {
        phone: string;
        message: string;
    }): Promise<SmsResult>;
    sendBulk(recipients: string[], message: string): Promise<SmsResult[]>;
    sendWithOptions(options: SmsOptions): Promise<SmsResult>;
}
