import { Model } from 'etherial/components/database/provider';
import type { FlowGraph } from '../types.js';
/**
 * One automation, as the customer built it.
 *
 * Unlike the ETHPulseLeaf models, this one ships with its `@Table` and is
 * registered by the leaf itself: it has no foreign key into the project's own
 * schema — `created_by_user_id` is a plain integer, deliberately not an
 * association — so there is nothing for a project to extend, and asking every
 * project to redeclare three tables to get automations would be a poor trade.
 */
export declare class Flow extends Model<Flow> {
    id: number;
    name: string;
    description: string;
    /**
     * Off by default. A flow is written over several sittings, and a
     * half-drawn graph that starts sending emails the moment it is saved is the
     * kind of surprise that makes people stop trusting the feature.
     */
    enabled: boolean;
    /** Registered trigger id, e.g. `model.appointments.created`. */
    trigger_id: string;
    trigger_config: Record<string, any>;
    graph: FlowGraph;
    /**
     * Secret half of this flow's inbound URL, for `webhook.received`. Generated
     * on demand rather than for every flow — an unused URL that answers is an
     * unused URL that can be found.
     */
    webhook_token: string;
    created_by_user_id: number;
    last_run_at: Date;
    last_error: string;
    run_count: number;
    error_count: number;
    /**
     * When the ticker last looked at this flow. Only meaningful for the pulled
     * kinds (`schedule`, `query`); it is what keeps a restart mid-minute from
     * firing an hourly flow twice.
     */
    last_tick_at: Date;
    deleted_at: Date;
    created_at: Date;
    updated_at: Date;
}
