import { Model } from 'etherial/components/database/provider';
/**
 * A notification text rewritten in the back-office, in one language. Without
 * a row, the code's text goes out.
 */
export declare class PulseText extends Model<PulseText> {
    id: number;
    key: string;
    locale: string;
    text: string;
    /** The code's text when this one was saved: when the code changes, the back-office says so. */
    default_hash: string | null;
    updated_by: number | null;
    created_at: Date;
    updated_at: Date;
}
