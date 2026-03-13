import {
    Column,
    Model,
    AllowNull,
    Default,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    UpdatedAt,
    DataType,
    AfterCreate,
} from 'etherial/components/database/provider'
import etherial from 'etherial'

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
 * import { BaseNotification } from '../ETHPulseLeaf/models/Notification'
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
export class BaseNotification extends Model<BaseNotification> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    declare id: number

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare title: string

    @AllowNull(true)
    @Column
    declare location: string

    @AllowNull(true)
    @Column
    declare location_id: number

    @AllowNull(true)
    @Column
    declare location_title: string

    @AllowNull(true)
    @Column
    declare sub_location: string

    @AllowNull(true)
    @Column
    declare sub_location_id: number

    @AllowNull(true)
    @Column
    declare sub_location_title: string

    @AllowNull(false)
    @Default(false)
    @Column
    declare is_opened: boolean

    @AllowNull(true)
    @Column
    declare deleted_at: Date

    // User relationships - to be defined with @ForeignKey/@BelongsTo in child class
    declare created_for_user_id: number
    declare created_for_user: any

    declare created_by_user_id: number
    declare created_by_user: any

    @CreatedAt
    declare created_at: Date

    @UpdatedAt
    declare updated_at: Date

    /**
     * Hook: Send push notification after creation
     * Automatically sends push to the user's devices
     */
    @AfterCreate
    static async sendPushNotification(instance: BaseNotification) {
        try {
            const pulseLeaf = (etherial as any).eth_pulse_leaf
            if (!pulseLeaf) {
                console.warn('[BaseNotification] ETHPulseLeaf not configured, skipping push')
                return
            }

            // Get the Device model from project (not ETHPulseLeaf)
            // This allows the project to use its own Device model with User relationship
            const sequelize = (instance as any).sequelize
            const DeviceModel = sequelize?.models?.Device

            if (!DeviceModel) {
                console.warn('[BaseNotification] Device model not found, skipping push')
                return
            }

            // Import DevicePushTokenStatus enum
            const { DevicePushTokenStatus } = await import('./Device.js')

            // Get user's active devices
            const devices = await DeviceModel.findAll({
                where: {
                    user_id: instance.created_for_user_id,
                    push_token_status: DevicePushTokenStatus.ENABLED,
                    status: true,
                },
            })

            if (devices.length === 0) {
                return
            }

            const tokens = devices.map((d: any) => d.push_token).filter(Boolean)
            if (tokens.length === 0) {
                return
            }

            // Build notification data
            const notificationData = instance.buildPushData()

            // Send push
            await pulseLeaf.push().sendMultiple(tokens, {
                body: instance.title || '',
                data: notificationData,
            })

            console.log(`[BaseNotification] Push sent to ${tokens.length} devices for notification ${instance.id}`)
        } catch (error) {
            console.error('[BaseNotification] Push notification error:', error)
        }
    }

    /**
     * Get the push notification title
     * Override in child class for custom title logic
     */
    getPushTitle(): string {
        return (etherial as any).eth_pulse_leaf?.config?.push?.defaultNotificationTitle || 'Notification'
    }

    /**
     * Build the push notification data payload
     * Override in child class to add custom fields
     */
    buildPushData(): Record<string, any> {
        return {
            model: 'Notification',
            id: this.id,
            location: this.location,
            location_id: this.location_id,
            location_title: this.location_title,
            sub_location: this.sub_location,
            sub_location_id: this.sub_location_id,
            sub_location_title: this.sub_location_title,
        }
    }

    /**
     * Mark notification as opened
     */
    async markAsOpened(): Promise<void> {
        if (!this.is_opened) {
            await this.update({ is_opened: true })
        }
    }

    /**
     * Soft delete the notification
     */
    async softDelete(): Promise<void> {
        await this.update({ deleted_at: new Date() })
    }
}

// Re-export for backwards compatibility
export { BaseNotification as ETHPulseLeafNotificationBaseModel }
