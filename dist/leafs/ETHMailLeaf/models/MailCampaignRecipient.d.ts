import { Model } from 'etherial/components/database/provider';
/**
 * `pending` → `sending` (taken by a batch) → `sent` | `failed`. `skipped`:
 * unsubscribed before it left. `cancelled`: the campaign was stopped first.
 */
export type MailRecipientStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped' | 'cancelled';
/** One address a campaign goes to, listed when the campaign starts. */
export declare class MailCampaignRecipient extends Model<MailCampaignRecipient> {
    id: number;
    campaign_id: number;
    /** Lower case. */
    email: string;
    user_id: number | null;
    locale: string;
    /** What fills this person's `{{variables}}`: their first name… */
    data: Record<string, unknown> | null;
    status: MailRecipientStatus;
    /** The batch that took it: two servers never send the same email. */
    claim: string | null;
    error: string | null;
    message_id: string | null;
    sent_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
