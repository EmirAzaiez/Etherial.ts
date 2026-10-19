import type { FieldDefinition } from '../../ETHAdminLeaf/features/ActionRegistry.js';
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
/** The model's literal defaults, so the project's rules see the campaign as it will be saved. */
export declare function modelDefaults(model: any): Record<string, any>;
/** The targeting fields of the form, the project's or the leaf's two boxes. */
export declare const campaignTargeting: (cfg: PushCampaignsConfig) => FieldDefinition[];
/** The back-office widget that draws the whole targeting, with its live count. */
export declare const PUSH_AUDIENCE_WIDGET = "push-audience";
/**
 * Registers the actions, hooks and both collections. Called from the leaf's
 * beforeRun: before the admin leaf resolves the hooks (its run) and installs
 * the change history on the collections that exist (its afterRun).
 *
 * A project that registers a `campaigns` collection of its own keeps it; the
 * actions and hooks are the leaf's either way.
 */
export declare function registerPushCampaignsAdmin(adminLeaf: any, cfg: PushCampaignsConfig): void;
