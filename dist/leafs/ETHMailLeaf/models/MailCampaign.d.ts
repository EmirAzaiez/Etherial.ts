import { Model } from 'etherial/components/database/provider';
/**
 * `draft` → `scheduled` → `preparing` (listing the recipients) → `sending` →
 * `sent`. `cancelled` stops it on the way; `failed` when its audience could
 * not be read.
 */
export type MailCampaignStatus = 'draft' | 'scheduled' | 'preparing' | 'sending' | 'sent' | 'cancelled' | 'failed';
/** An email written in the back-office and sent to an audience, once. */
export declare class MailCampaign extends Model<MailCampaign> {
    id: number;
    /** For the back-office only: recipients never see it. */
    name: string;
    status: MailCampaignStatus;
    /** One of the project's audiences, by key. */
    audience: string | null;
    /** Its name when the campaign was scheduled: the audience may be renamed or deleted since. */
    audience_label: string | null;
    /** `{ en: { subject, preheader, blocks }, ar: { … } }`. A language left out gets the default one's. */
    content: Record<string, {
        subject: string;
        preheader: string;
        blocks: any[];
    }>;
    scheduled_at: Date | null;
    started_at: Date | null;
    finished_at: Date | null;
    /** Where the unsubscribe links point: the config's `publicUrl`, else the API's address when it was scheduled. */
    public_url: string | null;
    recipients_count: number;
    sent_count: number;
    failed_count: number;
    /** Unsubscribed before it left, or stopped by a cancel. */
    skipped_count: number;
    /** Unsubscribed through this campaign's link. */
    unsubscribed_count: number;
    error: string | null;
    created_by: number | null;
    updated_by: number | null;
    scheduled_by: number | null;
    created_at: Date;
    updated_at: Date;
}
