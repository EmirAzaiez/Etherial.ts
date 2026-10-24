import type { LeafSync } from '../../../components/sync/index.js';
export declare const SCHEDULERS_COLLECTION = "schedulers";
export declare const WINDOWS_COLLECTION = "scheduler-windows";
export declare const BLOCKS_COLLECTION = "scheduler-blocks";
export declare const AGENTS_COLLECTION = "agents";
export declare const APPOINTMENTS_COLLECTION = "booking-appointments";
export declare const CALENDAR_PAGE = "appointments-calendar";
/**
 * The field the shared back-office's slot picker reads the subject from (the
 * property at RETAL, where it was written). A project whose subject column has
 * another name adds a VIRTUAL `property_id` alias on its appointment model.
 */
export declare const BO_SUBJECT_FIELD = "property_id";
/** The project's model names, as registered in Sequelize. */
export interface BookingModelNames {
    Scheduler: string;
    SchedulerWindow: string;
    SchedulerWindowHost: string;
    SchedulerBlock: string;
    Agent: string;
    BookingAppointment: string;
}
/** What a customer is told about, through `notify`. */
export type BookingNoticeKind = 'confirmed' | 'rescheduled' | 'cancelled' | 'reminder_day_before' | 'reminder_soon';
export interface BookingNotice {
    kind: BookingNoticeKind;
    /** The appointment, as saved. */
    appointment: any;
    /** The zone to show its time in: the scheduler's, else the leaf's. */
    timezone: string;
}
export interface ETHBookingLeafConfig {
    /** The zone the opening hours are written in: 'Asia/Dubai'. A scheduler may set its own. Default 'UTC'. */
    timezone?: string;
    /**
     * The days a notice in working days skips, as `Date.getDay()` numbers:
     * [6, 0] Saturday and Sunday (the default), [5, 6] Friday and Saturday. A
     * scheduler may set its own.
     */
    weekend?: number[];
    /** The project's model names, when they differ from the defaults. */
    models?: Partial<BookingModelNames>;
    /**
     * What a scheduler belongs to (a project): its column on the schedulers.
     * Without it, every scheduler is open to every customer.
     */
    scope?: {
        /** Column on the schedulers: 'project_id'. */
        field: string;
        /** Its model, included when schedulers are read (the app shows its name): 'Project'. */
        model?: string;
        /** Its back-office collection, for the relation field: 'projects'. */
        collection?: string;
        displayField?: string;
        secondaryField?: string;
        /** 'Project'. */
        label?: string;
        /** Under the scheduler's field in the back-office. */
        helpText?: string;
    };
    /**
     * What an appointment is about (a unit): its column on the appointments.
     * The subject's own `scopeField` tells which schedulers govern it.
     */
    subject?: {
        /** Column on the appointments: 'unit_id'. */
        field: string;
        /** Its model: 'Unit'. */
        model: string;
        /** Column on the subject naming its scope: 'project_id'. */
        scopeField?: string;
        /** Its back-office collection: 'units'. */
        collection?: string;
        displayField?: string;
        secondaryField?: string;
        /** 'Unit'. */
        label?: string;
        /** Said to staff when a subject has no scope: "Run the Salesforce sync." */
        noScopeHint?: string;
    };
    /** The customers' model, back-office collection and the field naming them. Default 'User' / 'users' / 'email'. */
    customers?: {
        model?: string;
        collection?: string;
        displayField?: string;
    };
    /**
     * Tells the customer: booked, moved, cancelled by someone else, and the
     * reminders. Runs in the background; its failure never fails the write.
     */
    notify?: (notice: BookingNotice) => unknown;
    /**
     * Reminders through `notify`: the day before (24 hours ahead) and shortly
     * before (2 hours ahead by default). Each goes out once, and only while it
     * is still ahead: a booking made an hour before gets neither.
     * Default: off.
     */
    reminders?: {
        dayBefore?: boolean;
        soon?: boolean;
        soonHours?: number;
    };
    /**
     * Tells staff in the back-office, once a day at `hour` (local), how many
     * appointments ended without being marked completed or no-show. Default: off.
     */
    overdue?: {
        hour?: number;
    };
    /** Sends each appointment to an outside system (`components/sync`). */
    sync?: LeafSync;
    /** The back-office the leaf registers. */
    admin?: {
        /** The sidebar group. Default 'Scheduling'. */
        group?: string;
        /**
         * Changes a collection before it is registered (an action, a field, an
         * assistant of the project's): returns it, changed or replaced.
         */
        extend?: (name: string, collection: any) => any;
    };
}
/** The running leaf's config, for its controllers, hooks and services. */
export declare const state: {
    config: ETHBookingLeafConfig;
};
export declare const timezoneOf: (scheduler?: {
    timezone?: string | null;
} | null) => string;
export declare const weekendOf: (scheduler?: {
    weekend_days?: number[] | null;
} | null) => number[];
/** The project's models, resolved by name: they exist once the database ran. */
export declare function bookingModels(): Record<keyof BookingModelNames, any>;
/** A model of the project the config names (the scope's, the subject's), or null. */
export declare function projectModel(name?: string | null): any;
/** "unit", "project": the words of the staff messages. */
export declare const subjectWord: () => string;
export declare const scopeWord: () => string;
/** The name an association from `model` to `target` goes by ('unit', 'user'), or null. */
export declare function associationTo(model: any, target: any): string | null;
/** The attributes of `model` among `names`: an include asks only for columns that exist. */
export declare function attributesOf(model: any, names: string[]): string[];
