import {
    Table,
    Column,
    Model,
    AllowNull,
    Default,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    UpdatedAt,
    DataType,
    Index,
    ForeignKey,
} from 'etherial/components/database/provider'

export enum MessageType {
    SMS = 'sms',
    EMAIL = 'email',
    PUSH = 'push',
}

export enum MessageStatus {
    PENDING = 'pending',
    SENT = 'sent',
    DELIVERED = 'delivered',
    FAILED = 'failed',
    BOUNCED = 'bounced',
}

export interface MessageLogAttributes {
    id: number
    type: MessageType
    provider: string
    recipient: string
    subject?: string
    status: MessageStatus
    external_id?: string
    error_message?: string
    metadata?: Record<string, any>
    user_id?: number
    created_at: Date
    updated_at: Date
}

@Table({
    tableName: 'message_logs',
    freezeTableName: true,
})
export class MessageLog extends Model<MessageLog> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    id: number

    @AllowNull(false)
    @Index
    @Column(DataType.ENUM(...Object.values(MessageType)))
    type: MessageType

    @AllowNull(false)
    @Index
    @Column(DataType.STRING(50))
    provider: string

    @AllowNull(false)
    @Index
    @Column(DataType.STRING(255))
    recipient: string

    @AllowNull(true)
    @Column(DataType.STRING(500))
    subject: string

    @AllowNull(false)
    @Default(MessageStatus.PENDING)
    @Index
    @Column(DataType.ENUM(...Object.values(MessageStatus)))
    status: MessageStatus

    @AllowNull(true)
    @Column(DataType.STRING(255))
    external_id: string

    @AllowNull(true)
    @Column(DataType.TEXT)
    error_message: string

    @AllowNull(true)
    @Column(DataType.JSON)
    metadata: Record<string, any>

    @AllowNull(true)
    @Index
    @Column
    user_id: number

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date

    /**
     * Log a new message
     */
    static async logMessage(data: {
        type: MessageType
        provider: string
        recipient: string
        subject?: string
        status?: MessageStatus
        externalId?: string
        errorMessage?: string
        metadata?: Record<string, any>
        userId?: number
    }): Promise<MessageLog> {
        return MessageLog.create({
            type: data.type,
            provider: data.provider,
            recipient: data.recipient,
            subject: data.subject,
            status: data.status || MessageStatus.PENDING,
            external_id: data.externalId,
            error_message: data.errorMessage,
            metadata: data.metadata,
            user_id: data.userId,
        })
    }

    /**
     * Update message status
     */
    async updateStatus(status: MessageStatus, externalId?: string, errorMessage?: string): Promise<void> {
        await this.update({
            status,
            external_id: externalId || this.external_id,
            error_message: errorMessage,
        })
    }

    /**
     * Mark as sent
     */
    async markAsSent(externalId?: string): Promise<void> {
        await this.updateStatus(MessageStatus.SENT, externalId)
    }

    /**
     * Mark as failed
     */
    async markAsFailed(errorMessage: string): Promise<void> {
        await this.updateStatus(MessageStatus.FAILED, undefined, errorMessage)
    }
}
