import { PushCampaignsConfig } from '../services/campaigns.js';
/**
 * The back-office side of push campaigns: the "Push campaigns" and "Push
 * deliveries" collections, their actions, and the hooks that turn the create
 * form's "When" choice into a draft, a schedule or an immediate send.
 *
 * The create request never sends anything itself: it schedules, and the engine
 * (services/campaigns.ts) sends, records the results and collects the receipts.
 */
export declare const CAMPAIGNS_COLLECTION = "campaigns";
export declare const CAMPAIGN_DELIVERIES_COLLECTION = "campaign-deliveries";
/**
 * Registers the actions, hooks and both collections. Called from the leaf's
 * beforeRun: before the admin leaf resolves the hooks (its run) and installs
 * the change history on the collections that exist (its afterRun).
 *
 * A project that registers a `campaigns` collection of its own keeps it; the
 * actions and hooks are the leaf's either way.
 */
export declare function registerPushCampaignsAdmin(adminLeaf: any, cfg: PushCampaignsConfig): void;
