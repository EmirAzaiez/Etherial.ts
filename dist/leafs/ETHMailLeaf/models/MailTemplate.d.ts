import { Model } from 'etherial/components/database/provider';
/**
 * The back-office's version of one email in one language. While it exists it
 * is sent instead of the one written in the project's code; deleting it goes
 * back to the code's.
 */
export declare class MailTemplate extends Model<MailTemplate> {
    id: number;
    /** The email's key, from the project's config. */
    key: string;
    locale: string;
    subject: string;
    preheader: string | null;
    blocks: any[];
    /** Who saved it last. */
    updated_by: number | null;
    /** The code's version when this one was saved: if the code changes since, the back-office says so. */
    default_hash: string | null;
    created_at: Date;
    updated_at: Date;
}
