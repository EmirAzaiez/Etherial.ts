import { IPushProvider, PushResult, PushMessage, PushOptions } from '../providers/push/IPushProvider.js';
import { Device } from '../models/Device.js';
export declare class PushService {
    private providers;
    private defaultProvider;
    constructor(providers: Map<string, IPushProvider>, defaultProvider: string);
    /**
     * Get a specific provider or the default one
     */
    provider(name?: string): IPushProvider;
    /**
     * Send push notification to a single device
     */
    send(pushToken: string, message: PushMessage, options?: PushOptions & {
        userId?: number;
        providerName?: string;
    }): Promise<PushResult>;
    /**
     * Send push notification to multiple devices
     */
    sendMultiple(pushTokens: string[], message: PushMessage, options?: PushOptions & {
        userIds?: number[];
        providerName?: string;
    }): Promise<PushResult[]>;
    /**
     * Send push notification to a Device model instance
     */
    sendToDevice(device: Device, message: PushMessage, options?: PushOptions & {
        providerName?: string;
    }): Promise<PushResult>;
    /**
     * Send push notification to multiple Device model instances
     */
    sendToDevices(devices: Device[], message: PushMessage, options?: PushOptions & {
        providerName?: string;
    }): Promise<PushResult[]>;
    /**
     * Log message to database
     */
    private logMessage;
}
