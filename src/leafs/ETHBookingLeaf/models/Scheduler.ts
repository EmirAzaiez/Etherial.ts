import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Default } from 'etherial/components/database/provider'

/** What the appointment is for: the back-office sorts and filters on it, the app doesn't show it. */
export enum SchedulerKind {
    HANDOVER = 'HANDOVER',
    SITE_VISIT = 'SITE_VISIT',
    MAINTENANCE = 'MAINTENANCE',
    MEETING = 'MEETING',
}

/**
 * Base Scheduler (no @Table: the project defines it): one reason to meet a
 * customer (the key handover, a site visit), with its notice, its horizon,
 * its rules and its on/off switch. Its opening hours and its staff are its
 * windows'.
 *
 * What it belongs to (a project) is the project's column, named in the
 * leaf's `scope` option, with its association `scope.model` in lower case.
 *
 * @example
 * ```typescript
 * @Table({ timestamps: true, tableName: 'schedulers', freezeTableName: true })
 * export class Scheduler extends BaseScheduler {
 *     @ForeignKey(() => Project)
 *     @AllowNull(true)
 *     @Column
 *     declare project_id: number
 *
 *     @BelongsTo(() => Project)
 *     declare project: Project
 *
 *     @HasMany(() => SchedulerWindow)
 *     declare windows: SchedulerWindow[]
 *
 *     @HasMany(() => SchedulerBlock)
 *     declare blocks: SchedulerBlock[]
 *
 *     @HasMany(() => BookingAppointment)
 *     declare appointments: BookingAppointment[]
 * }
 * ```
 */
export class BaseScheduler extends Model<any> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column(DataType.INTEGER)
    id: number

    /** What the customer reads in the app: "Key handover". */
    @AllowNull(true)
    @Column(DataType.STRING)
    label: string

    @AllowNull(true)
    @Column(DataType.STRING)
    label_ar: string

    @AllowNull(false)
    @Default(SchedulerKind.SITE_VISIT)
    @Column(DataType.STRING)
    kind: SchedulerKind

    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    active: boolean

    /** Off: staff book it from the back-office, customers don't see it. */
    @AllowNull(false)
    @Default(true)
    @Column(DataType.BOOLEAN)
    show_in_mobile_app: boolean

    /** The first and last days it receives (local `YYYY-MM-DD`), when it has a season. */
    @AllowNull(true)
    @Column(DataType.DATEONLY)
    starts_on: string

    @AllowNull(true)
    @Column(DataType.DATEONLY)
    ends_on: string

    /** The days between booking and the visit: 1 lets no one book for today. */
    @AllowNull(false)
    @Default(1)
    @Column(DataType.INTEGER)
    lead_time_days: number

    /** The notice counts working days: the weekend (`weekend_days`, else the leaf's) is skipped. */
    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    lead_time_working_days: boolean

    /** How far ahead a customer may book. */
    @AllowNull(false)
    @Default(60)
    @Column(DataType.INTEGER)
    horizon_days: number

    @AllowNull(false)
    @Default(true)
    @Column(DataType.BOOLEAN)
    allow_cancellation: boolean

    @AllowNull(false)
    @Default(48)
    @Column(DataType.INTEGER)
    cancellation_notice_hours: number

    @AllowNull(false)
    @Default(true)
    @Column(DataType.BOOLEAN)
    allow_reschedule: boolean

    @AllowNull(false)
    @Default(48)
    @Column(DataType.INTEGER)
    reschedule_notice_hours: number

    @AllowNull(true)
    @Column(DataType.INTEGER)
    max_reschedules: number

    /** Upcoming appointments a customer may hold at once (null: no limit). */
    @AllowNull(true)
    @Default(1)
    @Column(DataType.INTEGER)
    max_active_appointments: number

    /** Appointments a customer may ever book, cancelled ones aside (null: no limit). */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    max_appointments_total: number

    @AllowNull(true)
    @Column(DataType.STRING)
    location: string

    @AllowNull(true)
    @Column(DataType.STRING)
    location_ar: string

    @AllowNull(true)
    @Column(DataType.TEXT)
    instructions: string

    @AllowNull(true)
    @Column(DataType.TEXT)
    instructions_ar: string

    /** The zone its hours are written in, when not the leaf's `timezone`. */
    @AllowNull(true)
    @Column(DataType.STRING)
    timezone: string | null

    /** The days its working-day notice skips (`Date.getDay()`), when not the leaf's `weekend`. */
    @AllowNull(true)
    @Column(DataType.ARRAY(DataType.INTEGER))
    weekend_days: number[] | null

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date
}
