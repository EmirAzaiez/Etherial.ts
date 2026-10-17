import {
    Table,
    Column,
    Model,
    AllowNull,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    DataType,
    Index,
} from 'etherial/components/database/provider'

/**
 * One change to one record: who made it, from where, and every column it
 * touched with its value before and after.
 *
 * Rows are keyed by model rather than by collection, so a record listed in two
 * collections (users and staff, say) shows the same history in both. The leaf
 * owns the table: projects that turn `features.audit` on get it on their next
 * sync. `actor_id` is a plain integer for the same reason as in the login
 * journal: the leaf does not know the project's user model, and Salesforce or
 * a cron job has no user at all.
 */
@Table({
    timestamps: true,
    updatedAt: false,
    tableName: 'admin_audit_logs',
    freezeTableName: true,
    indexes: [{ fields: ['model', 'record_id', 'id'] }, { fields: ['created_at'] }],
})
export class AdminAuditLog extends Model<AdminAuditLog> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    declare id: number

    /** The collection the change was first registered under, for display. */
    @AllowNull(false)
    @Index
    @Column(DataType.STRING)
    declare collection: string

    /** The Sequelize model name: what histories are looked up by. */
    @AllowNull(false)
    @Column(DataType.STRING)
    declare model: string

    @AllowNull(false)
    @Column(DataType.STRING)
    declare record_id: string

    /** create, update, delete or restore. */
    @AllowNull(false)
    @Index
    @Column(DataType.STRING(16))
    declare action: string

    /** `{ column: [before, after] }`. A create has `null` befores, a delete `null` afters. */
    @AllowNull(false)
    @Column(DataType.JSON)
    declare changes: Record<string, [unknown, unknown]>

    /** user, salesforce, system, or any name an integration gives itself. */
    @AllowNull(false)
    @Index
    @Column(DataType.STRING(32))
    declare actor_type: string

    @AllowNull(true)
    @Index
    @Column(DataType.INTEGER)
    declare actor_id: number | null

    /** The actor's name or email when the change was made: it outlives renames and deletions. */
    @AllowNull(true)
    @Column(DataType.STRING)
    declare actor_label: string | null

    /** back-office, app, salesforce, system… where the change came through. */
    @AllowNull(true)
    @Index
    @Column(DataType.STRING(32))
    declare source: string | null

    /** Extra context, e.g. `{ restored_from: 42 }` when the change undid another one. */
    @AllowNull(true)
    @Column(DataType.JSON)
    declare meta: Record<string, unknown> | null

    @CreatedAt
    declare created_at: Date
}
