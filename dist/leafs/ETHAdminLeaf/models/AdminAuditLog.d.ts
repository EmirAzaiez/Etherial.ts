import { Model } from 'etherial/components/database/provider';
/**
 * One change to one record: who made it, from where, and every column it
 * touched with its value before and after.
 *
 * Rows are keyed by model rather than by collection, so a record listed in two
 * collections (users and staff, say) shows the same history in both. The leaf
 * owns the table: projects that turn `features.audit` on get it on their next
 * sync. `actor_id` is a plain integer for the same reason as in the login
 * journal: the leaf does not know the project's user model, and Salesforce or
 * a cron job has no user at all.
 */
export declare class AdminAuditLog extends Model<AdminAuditLog> {
    id: number;
    /** The collection the change was first registered under, for display. */
    collection: string;
    /** The Sequelize model name: what histories are looked up by. */
    model: string;
    record_id: string;
    /** create, update, delete or restore. */
    action: string;
    /** `{ column: [before, after] }`. A create has `null` befores, a delete `null` afters. */
    changes: Record<string, [unknown, unknown]>;
    /** user, salesforce, system, or any name an integration gives itself. */
    actor_type: string;
    actor_id: number | null;
    /** The actor's name or email when the change was made: it outlives renames and deletions. */
    actor_label: string | null;
    /** back-office, app, salesforce, system… where the change came through. */
    source: string | null;
    /** Extra context, e.g. `{ restored_from: 42 }` when the change undid another one. */
    meta: Record<string, unknown> | null;
    created_at: Date;
}
