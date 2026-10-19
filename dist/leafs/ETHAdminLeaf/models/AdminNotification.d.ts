import { Model } from 'etherial/components/database/provider';
/**
 * One line in one back-office user's inbox: a mention, a flow step, a campaign
 * that finished.
 *
 * A notification sent to five people is five rows, not one row and a join
 * table: each recipient reads it on their own, and the bell only ever asks
 * "how many unread for me", which `(user_id, read_at)` answers from the index.
 * `user_id` and `actor_id` are plain integers for the same reason as in the
 * audit log: the leaf does not know the project's user model.
 */
export declare class AdminNotification extends Model<AdminNotification> {
    id: number;
    user_id: number;
    /** mention, flow, campaign, or any name a project gives its own. */
    type: string;
    title: string;
    body: string | null;
    /** A back-office path, e.g. `/orders/12`: the bell navigates to it. */
    link: string | null;
    collection: string | null;
    record_id: string | null;
    actor_id: number | null;
    data: Record<string, unknown> | null;
    read_at: Date | null;
    /** Set once an email went out for it, so the digest never sends it twice. */
    emailed_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
