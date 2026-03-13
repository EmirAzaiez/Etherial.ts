import { Model } from 'etherial/components/database/provider';
/**
 * Base Notification Model for ETHPulseLeaf
 *
 * Provides:
 * - Core notification fields (title, location, etc.)
 * - Automatic push notification on create (via ETHPulseLeaf)
 * - Soft delete support (deleted_at)
 *
 * Usage in your project:
 * ```typescript
 * import { BaseNotification } from '../ETHPulseLeaf/models/Notification.js'
 *
 * @Table({ tableName: 'notifications' })
 * export class Notification extends BaseNotification {
 *     @ForeignKey(() => User)
 *     @Column
 *     declare created_for_user_id: number
 *
 *     @BelongsTo(() => User)
 *     declare created_for_user: User
 * }
 * ```
 */
export declare class BaseNotification extends Model<BaseNotification> {
    id: number;
    title: string;
    location: string;
    location_id: number;
    location_title: string;
    sub_location: string;
    sub_location_id: number;
    sub_location_title: string;
    is_opened: boolean;
    deleted_at: Date;
    created_for_user_id: number;
    created_for_user: any;
    created_by_user_id: number;
    created_by_user: any;
    created_at: Date;
    updated_at: Date;
    /**
     * Hook: Send push notification after creation
     * Automatically sends push to the user's devices
     */
    static sendPushNotification(instance: BaseNotification): Promise<void>;
    /**
     * Get the push notification title
     * Override in child class for custom title logic
     */
    getPushTitle(): string;
    /**
     * Build the push notification data payload
     * Override in child class to add custom fields
     */
    buildPushData(): Record<string, any>;
    /**
     * Mark notification as opened
     */
    markAsOpened(): Promise<void>;
    /**
     * Soft delete the notification
     */
    softDelete(): Promise<void>;
}
export { BaseNotification as ETHPulseLeafNotificationBaseModel };
