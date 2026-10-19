import { Model } from 'etherial/components/database/provider';
/**
 * An internal note left by staff on a record, never shown to the record's own
 * user.
 *
 * Keyed by collection and record id rather than by model, so a note follows the
 * screen people wrote it on. Paranoid: a note deleted by mistake can be brought
 * back from the database, and a mention notification pointing at it still has
 * something to explain it.
 */
export declare class AdminNote extends Model<AdminNote> {
    id: number;
    collection: string;
    record_id: string;
    author_id: number;
    /** Plain text with mentions written as `@[Display Name](user:12)`. */
    body: string;
    /** The user ids mentioned in `body`, kept so an edit only notifies the new ones. */
    mentions: number[] | null;
    edited_at: Date | null;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}
