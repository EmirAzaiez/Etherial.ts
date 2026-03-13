import { Model } from 'etherial/components/database/provider';
/**
 * Base NotificationCampaign Model (no @Table - define it in your project)
 */
export declare class BaseNotificationCampaign extends Model<BaseNotificationCampaign> {
    id: number;
    message: string;
    data: any;
    url: string;
    devices_count: number;
    target_logged_user: boolean;
    target_not_logged_user: boolean;
    created_by_user_id: number;
    created_at: Date;
    updated_at: Date;
}
export { BaseNotificationCampaign as NotificationCampaign };
