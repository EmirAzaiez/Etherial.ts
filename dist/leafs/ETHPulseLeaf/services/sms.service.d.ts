import { ISmsProvider, SmsResult } from '../providers/sms/ISmsProvider.js';
export declare class SmsService {
    private providers;
    private defaultProvider;
    constructor(providers: Map<string, ISmsProvider>, defaultProvider: string);
    /**
     * Get a specific provider or the default one
     */
    provider(name?: string): ISmsProvider;
    /**
     * Send SMS using the default or specified provider
     */
    send(params: {
        phone: string;
        message: string;
    }, providerName?: string): Promise<SmsResult>;
    /**
     * Send SMS to multiple recipients
     */
    sendBulk(recipients: string[], message: string, providerName?: string): Promise<SmsResult[]>;
    /**
     * Send verification code SMS
     */
    sendVerificationCode(to: string, code: string, providerName?: string): Promise<SmsResult>;
    /**
     * Log message to database
     */
    private logMessage;
}
