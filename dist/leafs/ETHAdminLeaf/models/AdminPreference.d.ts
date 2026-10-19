import { Model } from 'etherial/components/database/provider';
/**
 * One back-office preference of one user (favorites, saved views, hidden
 * columns…), so they follow the account from one browser to the next.
 *
 * One row per key rather than one blob per user: the back-office writes each
 * key on its own, so two tabs saving different keys never overwrite each
 * other. `user_id` is a plain integer, like the login journal's: the leaf does
 * not know the project's user model.
 */
export declare class AdminPreference extends Model<AdminPreference> {
    id: number;
    user_id: number;
    key: string;
    value: unknown;
    created_at: Date;
    updated_at: Date;
}
