import { IPushProvider, PushResult, PushMessage, PushOptions } from './IPushProvider.js';
export interface ExpoConfig {
    accessToken?: string;
}
export declare class ExpoProvider implements IPushProvider {
    readonly name = "expo";
    private expo;
    constructor(config?: ExpoConfig);
    send(pushToken: string, message: PushMessage, options?: PushOptions): Promise<PushResult>;
    sendMultiple(pushTokens: string[], message: PushMessage, options?: PushOptions): Promise<PushResult[]>;
    /**
     * Check receipts for previously sent notifications
     */
    checkReceipts(ticketIds: string[]): Promise<Map<string, {
        status: string;
        error?: string;
    }>>;
}
