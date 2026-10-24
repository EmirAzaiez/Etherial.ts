import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType } from 'etherial/components/database/provider'

/** What happened to a case, besides its messages. */
export enum CaseEventType {
    CREATED = 'created',
    STATUS = 'status',
    ASSIGNED = 'assigned',
    PRIORITY = 'priority',
    CATEGORY = 'category',
    KIND = 'kind',
    REOPENED = 'reopened',
    CONFIRMED = 'confirmed',
    REJECTED = 'rejected',
    RATED = 'rated',
    OVERDUE = 'overdue',
}

/**
 * A case's history, shown between its messages in the back-office: who
 * changed the status, the assignee, the priority, and when the customer
 * confirmed, rejected or rated a resolution. Written by the case's hooks,
 * whoever writes (the app, staff, a sync).
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'case_events',
    freezeTableName: true,
    indexes: [{ name: 'case_events_case_id', fields: ['case_id', 'created_at'] }],
})
export class CaseEvent extends Model<CaseEvent> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare case_id: number

    @AllowNull(false)
    @Column(DataType.STRING(32))
    declare type: CaseEventType

    @AllowNull(true)
    @Column(DataType.STRING(255))
    declare from_value: string | null

    @AllowNull(true)
    @Column(DataType.STRING(255))
    declare to_value: string | null

    /** `user`, `system`, `salesforce`…: the author of the write (ETHAdminLeaf's audit). */
    @AllowNull(true)
    @Column(DataType.STRING(32))
    declare actor_type: string | null

    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare actor_id: number | null

    @AllowNull(true)
    @Column(DataType.STRING(255))
    declare actor_label: string | null

    /** `back-office`, `app`, `system`… */
    @AllowNull(true)
    @Column(DataType.STRING(32))
    declare source: string | null

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare note: string | null

    declare created_at: Date
}
