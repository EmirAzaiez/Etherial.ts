import type { FieldDefinition } from '../../ETHAdminLeaf/features/ActionRegistry.js';
import type { CollectionMeta } from '../../ETHAdminLeaf/features/CollectionConfig.js';
/**
 * Push campaigns: the engine behind the back-office "Push campaigns".
 *
 * A campaign is never sent from the request that creates it. "Send now" only
 * schedules it for now and kicks the dispatcher; everything else goes through
 * the sweep below, which sends what is due and then collects Expo's receipts.
 *
 * Expo is called directly rather than through the push service: the provider
 * keeps the ticket ids but drops the error codes, and those codes are the
 * whole point here (a `DeviceNotRegistered` receipt is what tells us a token
 * is dead and must stop being counted). The service would also log every
 * device in the message log, where a campaign has its own deliveries.
 */
/**
 * Who a campaign reaches, as the project's audience rule decides it.
 *
 * `userIds` set: the devices of those users only (an empty list reaches
 * nobody, it is a real answer, not a missing filter). `userWhere` set: the
 * devices of the users it matches, filtered in the same query (an account
 * type, a segment's ids…). Neither: every signed-in user's device, unless
 * `users` is false. `guests` adds the devices nobody is signed in on (not with
 * `userWhere`); they never get a notification-centre entry.
 */
export interface PushCampaignAudience {
    userIds?: number[];
    userWhere?: Record<string | symbol, any>;
    users?: boolean;
    guests?: boolean;
}
export interface PushCampaignsConfig {
    /**
     * The project's models: its campaign extends `BasePushCampaign` with
     * `@Table(pushCampaignTable)`, its delivery `BaseNotificationCampaignDelivery`
     * with `@Table(notificationCampaignDeliveryTable)`. The devices, users and
     * notification centre default to the database's `Device`, `User` and
     * `Notification` models.
     */
    models: {
        campaign: any;
        delivery: any;
        device?: any;
        user?: any;
        notification?: any;
    };
    /**
     * Who the campaign reaches, from the project's own targeting columns (a
     * segment, an account type…). A list of user ids is the same as `{ userIds }`;
     * `{ userWhere }` filters the users in the sending query itself.
     * Asked at send time, and again for the notification centre.
     * Default: the campaign's two boxes, `target_logged_user` / `target_not_logged_user`.
     */
    audience?: (campaign: any) => Promise<PushCampaignAudience | number[]>;
    /** Does this device get the Arabic copy? Default: its locale starts with "ar". */
    arabic?: (device: any) => boolean;
    /** Columns of the device's user (`device.user`) that `arabic` reads. */
    userAttributes?: string[];
    /**
     * The project's own rules, given the campaign as it would be saved (the
     * model's defaults filled in on create). Throw an Error to refuse it.
     */
    validate?: (campaign: Record<string, any>) => void | Promise<void>;
    /** The zone "Send At" is read in, in the Schedule summary. Default UTC. */
    timeZone?: {
        id: string;
        label: string;
    };
    /** Who gets the campaigns, in the back-office texts. Default "users". */
    audienceNoun?: string;
    /**
     * Leave each campaign in the app's notification centre (one entry per
     * user, location "Campaign") when its "Show in notification screen" is on.
     * Default on, when the project has a notification model.
     */
    inbox?: boolean;
    /** Run the sweep in this process. Default on. */
    sweep?: boolean;
    admin?: {
        /**
         * The targeting fields of the form and of the show page, in order.
         * Default: the leaf's two boxes, logged-in users and guests.
         */
        targeting?: FieldDefinition[];
        /** Changes to the default fields, by name (a help text, a label…). */
        fields?: Record<string, Partial<FieldDefinition>>;
        meta?: Partial<CollectionMeta>;
    };
}
/** The `location` of a campaign in the notification centre (the bell). */
export declare const CAMPAIGN_NOTIFICATION_LOCATION = "Campaign";
export declare function setCampaignsConfig(value: PushCampaignsConfig | undefined): void;
export declare function campaignsConfig(): PushCampaignsConfig;
export declare const defaultCampaignTitle: () => string;
/**
 * Leaves the campaign in the notification centre of every signed-in user it
 * targets, one entry per user (not per device), in the language of the device
 * they used last. Users who refused push get it too: the centre is where they
 * can still find it.
 *
 * A push alone leaves no trace in the app: once the banner is gone, the
 * campaign cannot be found anywhere. Safe to call again, a user who already
 * has the entry is skipped.
 *
 * `bulkCreate` on purpose: a Notification created one by one pushes itself
 * (@AfterCreate in the base notification), and the campaign has already pushed.
 */
export declare function publishCampaignToInbox(campaign: any): Promise<number>;
/** Recomputes the campaign's counters from its deliveries (one query). */
export declare function refreshCampaignStats(campaignId: number): Promise<void>;
/**
 * Sends a campaign that is due. Safe to call from anywhere, any number of times,
 * from any number of API instances: the status flip to `sending` is the claim,
 * and only the caller that wins it sends anything.
 *
 * Returns false when the campaign was not claimable (not scheduled, or not due).
 */
export declare function dispatchCampaign(campaignId: number): Promise<boolean>;
/**
 * Sends the campaign, exactly as people will get it, to one user's devices
 * only. Nothing is recorded: a test never counts in the results.
 */
export declare function sendCampaignTest(campaign: any, userId: number): Promise<{
    devices: number;
    sent: number;
    errors: string[];
}>;
/** The user a test goes to, by email, whatever its case. */
export declare function findCampaignTestUser(email: string): Promise<any | null>;
/**
 * Collects the receipts of the tickets old enough to have one. Receipts that
 * are not ready yet are simply retried on the next pass.
 */
export declare function collectReceipts(): Promise<void>;
/**
 * The app reports a tap on a campaign push, with its installation id. Idempotent:
 * only the first tap on a device counts (the app re-reports the launch
 * notification on every cold start).
 */
export declare function recordCampaignOpen(campaignId: number, installationId: string): Promise<boolean>;
/**
 * Start the campaign sweep: due campaigns every minute, receipts every five.
 * The first pass waits a little, for the project's start-up migrations.
 *
 * A campaign left in `sending` by a crash mid-dispatch is NOT retried: some of
 * its pushes are already out, and sending again would double them. It shows up
 * as `sending` in the back-office, with its partial results.
 */
export declare function startCampaignSweep(): void;
