import { Model } from 'etherial/components/database/provider';
export declare enum MessageType {
    SMS = "sms",
    EMAIL = "email",
    PUSH = "push"
}
export declare enum MessageStatus {
    PENDING = "pending",
    SENT = "sent",
    DELIVERED = "delivered",
    FAILED = "failed",
    BOUNCED = "bounced"
}
export interface MessageLogAttributes {
    id: number;
    type: MessageType;
    provider: string;
    recipient: string;
    subject?: string;
    status: MessageStatus;
    external_id?: string;
    error_message?: string;
    metadata?: Record<string, any>;
    user_id?: number;
    created_at: Date;
    updated_at: Date;
}
/**
 * Base MessageLog Model (no @Table - define it in your project)
 */
export declare class BaseMessageLog extends Model<BaseMessageLog> {
    id: number;
    type: MessageType;
    provider: string;
    recipient: string;
    subject: string;
    status: MessageStatus;
    external_id: string;
    error_message: string;
    metadata: Record<string, any>;
    user_id: number;
    created_at: Date;
    updated_at: Date;
    /**
     * Log a message to the database
     * Uses the registered MessageLog model from Sequelize (not the base class)
     */
    static logMessage(data: {
        type: MessageType;
        provider: string;
        recipient: string;
        subject?: string;
        status?: MessageStatus;
        externalId?: string;
        errorMessage?: string;
        metadata?: Record<string, any>;
        userId?: number;
    }): Promise<BaseMessageLog>;
    updateStatus(status: MessageStatus, externalId?: string, errorMessage?: string): Promise<void>;
    markAsSent(externalId?: string): Promise<void>;
    markAsFailed(errorMessage: string): Promise<void>;
}
export { BaseMessageLog as MessageLog };
