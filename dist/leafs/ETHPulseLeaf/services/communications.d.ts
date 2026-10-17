export type CommunicationChannel = 'push' | 'sms' | 'email' | 'inbox' | (string & {});
export interface CommunicationEntry {
    /** Unique across sources: `<source>:<id>`. */
    id: string;
    channel: CommunicationChannel;
    at: Date | string;
    title?: string | null;
    body?: string | null;
    /** sent, delivered, failed, opened, unread… */
    status?: string | null;
    recipient?: string | null;
    error?: string | null;
    /** Where it came from, in words: "Campaign", "Transactional", "Back-office". */
    source?: string | null;
    /** The device it went to, for a push. */
    device?: string | null;
    /** The record behind it in the back-office. */
    link?: {
        collection: string;
        id: string | number;
    } | null;
    /** The push side of the message, across the user's devices. */
    push?: PushSummary | null;
    /**
     * Entries that are one message seen from several tables share a key: the
     * push of an inbox entry gives `inbox:<notification id>`, the key the
     * entry itself has. The timeline shows them as one.
     */
    groupKey?: string;
}
export interface PushSummary {
    /** failed when no device got it, else the furthest any device got. */
    status: string;
    devices: number;
    failed: number;
    delivered?: number;
    opened?: number;
}
export interface CommunicationQuery {
    userId: number;
    user: any;
    /** Only entries strictly older than this. */
    before?: Date;
    limit: number;
    channel?: string;
}
export interface CommunicationSource {
    /** The channels this source can return, so a filtered query skips it. */
    channels: CommunicationChannel[];
    list(query: CommunicationQuery): Promise<CommunicationEntry[]>;
    count?(query: CommunicationQuery): Promise<Partial<Record<string, number>>>;
}
export interface CommunicationsConfig {
    /** The admin collection the timeline is shown on. Default `users`. */
    usersCollection?: string;
    /** The Sequelize model of that collection. Default `User`. */
    userModel?: string;
}
export declare function communicationsOptions(value: boolean | CommunicationsConfig | undefined): CommunicationsConfig | null;
export declare function registerCommunicationSource(name: string, source: CommunicationSource): void;
/** The admin collection a model is listed in, so an entry can link to its record. */
export declare function collectionOf(model: any): string | null;
export declare function deviceLabel(device: any): string;
export declare function userCommunications(options: {
    userId: number;
    before?: Date;
    limit?: number;
    channel?: string;
    config: CommunicationsConfig;
}): Promise<{
    devices: {
        id: any;
        label: string;
        platform: string;
        os_version: any;
        app_version: any;
        locale: any;
        tz: any;
        push_enabled: boolean;
        active: boolean;
        push_token: string;
        last_activity: any;
        created_at: any;
    }[];
    items: {
        /** Unique across sources: `<source>:<id>`. */
        id: string;
        channel: CommunicationChannel;
        at: Date | string;
        title?: string | null;
        body?: string | null;
        /** sent, delivered, failed, opened, unread… */
        status?: string | null;
        recipient?: string | null;
        error?: string | null;
        /** Where it came from, in words: "Campaign", "Transactional", "Back-office". */
        source?: string | null;
        /** The device it went to, for a push. */
        device?: string | null;
        /** The record behind it in the back-office. */
        link?: {
            collection: string;
            id: string | number;
        } | null;
        /** The push side of the message, across the user's devices. */
        push?: PushSummary | null;
    }[];
    counts: Record<string, number>;
    nextBefore: string;
}>;
