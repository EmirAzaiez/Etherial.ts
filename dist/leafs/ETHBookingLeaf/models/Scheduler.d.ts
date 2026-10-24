import { Model } from 'etherial/components/database/provider';
/** What the appointment is for: the back-office sorts and filters on it, the app doesn't show it. */
export declare enum SchedulerKind {
    HANDOVER = "HANDOVER",
    SITE_VISIT = "SITE_VISIT",
    MAINTENANCE = "MAINTENANCE",
    MEETING = "MEETING"
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
export declare class BaseScheduler extends Model<any> {
    id: number;
    /** What the customer reads in the app: "Key handover". */
    label: string;
    label_ar: string;
    kind: SchedulerKind;
    active: boolean;
    /** Off: staff book it from the back-office, customers don't see it. */
    show_in_mobile_app: boolean;
    /** The first and last days it receives (local `YYYY-MM-DD`), when it has a season. */
    starts_on: string;
    ends_on: string;
    /** The days between booking and the visit: 1 lets no one book for today. */
    lead_time_days: number;
    /** The notice counts working days: the weekend (`weekend_days`, else the leaf's) is skipped. */
    lead_time_working_days: boolean;
    /** How far ahead a customer may book. */
    horizon_days: number;
    allow_cancellation: boolean;
    cancellation_notice_hours: number;
    allow_reschedule: boolean;
    reschedule_notice_hours: number;
    max_reschedules: number;
    /** Upcoming appointments a customer may hold at once (null: no limit). */
    max_active_appointments: number;
    /** Appointments a customer may ever book, cancelled ones aside (null: no limit). */
    max_appointments_total: number;
    location: string;
    location_ar: string;
    instructions: string;
    instructions_ar: string;
    /** The zone its hours are written in, when not the leaf's `timezone`. */
    timezone: string | null;
    /** The days its working-day notice skips (`Date.getDay()`), when not the leaf's `weekend`. */
    weekend_days: number[] | null;
    created_at: Date;
    updated_at: Date;
}
