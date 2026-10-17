import { Model } from 'etherial/components/database/provider';
/**
 * The leaf's settings that live in the database: the brand as the back-office
 * changed it (`theme`), the secret that signs unsubscribe links.
 */
export declare class MailSetting extends Model<MailSetting> {
    id: number;
    key: string;
    value: any;
    updated_by: number | null;
    created_at: Date;
    updated_at: Date;
}
