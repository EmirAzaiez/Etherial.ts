import { Model } from 'etherial/components/database/provider';
/**
 * Every save of an email in the back-office, and every reset to the code's
 * version: what the email said, who changed it, when. Read by the editor's
 * history, which can bring an old version back.
 */
export declare class MailTemplateVersion extends Model<MailTemplateVersion> {
    id: number;
    key: string;
    locale: string;
    /** `save`: this content went out from then on. `reset`: back to the code's version (no content). */
    action: 'save' | 'reset';
    subject: string | null;
    preheader: string | null;
    blocks: any[] | null;
    created_by: number | null;
    /** The version this save brought back, when it came from the history. */
    restored_from: number | null;
    created_at: Date;
}
