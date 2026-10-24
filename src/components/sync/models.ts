import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default } from '../database/provider.js'

/** Where a record stands with the outside system it is copied to. */
export enum SyncStatus {
    /** A change waits to be sent. */
    PENDING = 'pending',
    /** A server is sending it now. */
    SENDING = 'sending',
    /** The outside system has the last state. */
    SYNCED = 'synced',
    /** The last try failed, another is planned (`next_attempt_at`). */
    FAILED = 'failed',
    /** Every try failed: only a new change or "Resend" starts again. */
    BLOCKED = 'blocked',
}

/**
 * One record of ours and its copy in an outside system (a Case in Salesforce…):
 * the copy's id, and whether it holds our last state. One row per record and
 * per target, kept after success: the next change reuses its `external_id`.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'external_syncs',
    freezeTableName: true,
    indexes: [
        { name: 'external_syncs_target_record_unique', unique: true, fields: ['target', 'record_id'] },
        { name: 'external_syncs_due', fields: ['target', 'status', 'next_attempt_at'] },
    ],
})
export class ExternalSync extends Model<ExternalSync> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** The registered target: 'cases', 'booking-appointments', 'survey-responses'… */
    @AllowNull(false)
    @Column(DataType.STRING(64))
    declare target: string

    /** Our record's primary key. */
    @AllowNull(false)
    @Column(DataType.STRING(64))
    declare record_id: string

    /** The copy's id over there, once the first send created it. */
    @AllowNull(true)
    @Column(DataType.STRING(255))
    declare external_id: string | null

    @AllowNull(false)
    @Default(SyncStatus.PENDING)
    @Column(DataType.STRING(16))
    declare status: SyncStatus

    /** Bumped by every change: a send that ends sees whether a newer one came in meanwhile. */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare version: number

    /** The fields changed since the last successful send. */
    @AllowNull(true)
    @Column(DataType.JSONB)
    declare changes: string[] | null

    /** Failed tries since the last success or the last change. */
    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare attempts: number

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare last_error: string | null

    @AllowNull(true)
    @Column(DataType.DATE)
    declare next_attempt_at: Date | null

    /** While sending: past it, the server is presumed gone and another may take over. */
    @AllowNull(true)
    @Column(DataType.DATE)
    declare locked_until: Date | null

    @AllowNull(true)
    @Column(DataType.DATE)
    declare synced_at: Date | null

    /** The link to the copy (`link` of the target), for the back-office. */
    @Column(DataType.VIRTUAL)
    get external_url(): string | null {
        return externalUrlOf(this.getDataValue('target'), this.getDataValue('external_id'))
    }

    declare created_at: Date
    declare updated_at: Date
}

/** One target and whether its sending is on hold. */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'external_sync_targets',
    freezeTableName: true,
    indexes: [{ name: 'external_sync_targets_target_unique', unique: true, fields: ['target'] }],
})
export class ExternalSyncTarget extends Model<ExternalSyncTarget> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    @AllowNull(false)
    @Column(DataType.STRING(64))
    declare target: string

    @AllowNull(true)
    @Column(DataType.STRING(255))
    declare label: string | null

    /** On hold: changes keep queuing, nothing is sent until it is turned off. */
    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    declare paused: boolean

    declare created_at: Date
    declare updated_at: Date
}

/** Set by the registry: models can't import it without a cycle. */
let linker: (target: string, externalId: string) => string | null = () => null

export function setExternalLinker(fn: typeof linker): void {
    linker = fn
}

function externalUrlOf(target: string | null, externalId: string | null): string | null {
    if (!target || !externalId) return null
    try {
        return linker(target, externalId)
    } catch {
        return null
    }
}
