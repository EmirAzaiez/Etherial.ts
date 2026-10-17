import { Model } from 'etherial/components/database/provider';
/**
 * An address that asked for no more campaigns. Campaigns skip it; the
 * emails a person needs (a sign-in code, an appointment) still go out.
 */
export declare class MailUnsubscribe extends Model<MailUnsubscribe> {
    id: number;
    /** Lower case. */
    email: string;
    user_id: number | null;
    /** The campaign whose link was used. */
    campaign_id: number | null;
    created_at: Date;
}
