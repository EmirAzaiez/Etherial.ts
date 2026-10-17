import { Model } from 'etherial/components/database/provider';
/**
 * One attempt to sign in to the back-office, kept whether it worked or not.
 *
 * The leaf owns the table, so every project that turns `features.loginJournal`
 * on gets it on its next sync. `user_id` is a plain integer rather than a
 * foreign key: the leaf does not know the project's user model, and a failed
 * attempt on an unknown address has no user at all.
 */
export declare class AdminLoginLog extends Model<AdminLoginLog> {
    id: number;
    user_id: number | null;
    /** What was typed in the login field (an email, usually), lower-cased. */
    identifier: string | null;
    success: boolean;
    /** Why it failed: the API's own error, or `no_admin_access` for a valid account with no back-office access. */
    reason: string | null;
    ip: string | null;
    /** "Chrome 141 on macOS", read from the user agent when it was logged. */
    client: string | null;
    user_agent: string | null;
    created_at: Date;
}
