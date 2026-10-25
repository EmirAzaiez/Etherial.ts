import { SchedulerKind } from '../models/Scheduler.js'
import { BookingAppointmentStatus } from '../models/BookingAppointment.js'
import { CANCEL_ACTION } from './features.js'
import {
    BO_SUBJECT_FIELD,
    associationTo,
    bookingModels,
    collectionNames,
    projectModel,
    scopeWord,
    state,
    subjectWord,
    timezoneOf,
    weekendOf,
} from '../services/options.js'
import { customerModel } from '../services/staff.js'
import { WEEKDAY_LABELS, WEEKDAY_SHORT, minutesToLabel, parseMinuteInput } from '../services/slots.js'

/**
 * The booking's back-office, in one sidebar group ("Scheduling"). The
 * appointments' collection is `booking-appointments` unless `admin.collections`
 * renames it (the calendar tells the shared back-office which one opens). A
 * collection the project already registered is left alone; `admin.extend`
 * changes one before it is registered.
 */

const capitalized = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

/** The days in `Date.getDay()` order, the weekend coloured apart. */
function weekdayOptions(weekend: number[]) {
    return WEEKDAY_LABELS.map((label, value) => ({
        value,
        label: `${label} (${WEEKDAY_SHORT[value]})`,
        color: weekend.includes(value) ? 'orange' : 'blue',
    }))
}

/**
 * What "working days" means here, with an example drawn from the weekend:
 * Fri–Sat gives "booking on Thursday is offered Monday at the earliest, not Saturday".
 */
function workingDaysHelp(weekend: number[]): string {
    if (!weekend.length) return 'No weekend is set, so working days and calendar days count the same.'
    const names = weekend.map((d) => WEEKDAY_LABELS[d])
    const first = weekend.find((d) => !weekend.includes((d + 6) % 7)) ?? weekend[0]
    const booked = (first + 6) % 7
    const plain = (booked + 2) % 7
    let working = booked
    for (let left = 2; left > 0; ) {
        working = (working + 1) % 7
        if (!weekend.includes(working)) left--
    }
    return (
        `Skips ${names.join(' and ')} when counting. With a 2-day notice, a customer booking on ${WEEKDAY_LABELS[booked]} is offered ` +
        `${WEEKDAY_LABELS[working]} at the earliest, not ${WEEKDAY_LABELS[plain]}. This does not close the weekend: a scheduler that receives on ${WEEKDAY_LABELS[first]} keeps offering it.`
    )
}

const KIND_OPTIONS = [
    { value: SchedulerKind.HANDOVER, label: 'Handover', color: 'green' },
    { value: SchedulerKind.SITE_VISIT, label: 'Site visit', color: 'blue' },
    { value: SchedulerKind.MAINTENANCE, label: 'Maintenance', color: 'orange' },
    { value: SchedulerKind.MEETING, label: 'Meeting', color: 'purple' },
]

const STATUS_OPTIONS = [
    { value: BookingAppointmentStatus.SCHEDULED, label: 'Scheduled', color: 'blue' },
    { value: BookingAppointmentStatus.COMPLETED, label: 'Completed', color: 'green' },
    { value: BookingAppointmentStatus.CANCELLED, label: 'Cancelled', color: 'gray' },
    { value: BookingAppointmentStatus.NO_SHOW, label: 'No Show', color: 'orange' },
]

/** Registers what the project hasn't, each passed through `admin.extend`. */
export function registerBookingCollections(adminLeaf: any): void {
    const config = state.config
    const group = config.admin?.group ?? 'Scheduling'
    const models = bookingModels()
    const names = collectionNames()
    const register = (collection: any) => {
        if (adminLeaf.getCollection?.(collection.name)) return
        adminLeaf.registerCollection(config.admin?.extend?.(collection.name, collection) ?? collection)
    }

    // A time is typed on a clock ("09:00") and kept in minutes after midnight.
    if (!adminLeaf.getCustomFieldType?.('time')) {
        adminLeaf.registerFieldType('time', {
            afterRead: (value: unknown) => (typeof value === 'number' ? minutesToLabel(value) : value),
            beforeSave: (value: unknown) => parseMinuteInput(value),
        })
    }

    const tz = timezoneOf()
    const weekend = weekendOf()
    const scope = config.scope
    const subject = config.subject
    const customers = { collection: config.customers?.collection ?? 'users', displayField: config.customers?.displayField ?? 'email' }
    const hasCustomers = !!adminLeaf.getCollection?.(customers.collection)
    const Customer = customerModel()
    const customerSecondary = Customer?.rawAttributes?.phone_number ? 'phone_number' : undefined

    const scopeAs = scope ? associationTo(models.Scheduler, projectModel(scope.model)) : null
    const scopeInclude = scopeAs
        ? [{ association: scopeAs, attributes: ['id', scope?.displayField ?? 'name', ...(scope?.secondaryField ? [scope.secondaryField] : [])] }]
        : []
    const subjectAs = subject ? associationTo(models.BookingAppointment, projectModel(subject.model)) : null
    const customerAs = associationTo(models.BookingAppointment, Customer)
    const subjectLabel = capitalized(subject?.label || 'Subject')
    const subjectDisplay = subject?.displayField ?? 'name'

    // ============================================
    // Schedulers: one per reason a scope receives its customers. Everything
    // that governs one is set on its page, in tabs; the child collections stay
    // registered (relations, inline editing) but out of the menu.
    // ============================================
    const scopeField = scope
        ? [
              {
                  name: scope.field,
                  type: 'relation',
                  label: scope.label ?? 'Project',
                  required: true,
                  filterable: true,
                  relation: scope.collection
                      ? { collection: scope.collection, displayField: scope.displayField ?? 'name', secondaryField: scope.secondaryField, searchable: true }
                      : undefined,
                  helpText:
                      scope.helpText ??
                      `The ${scopeWord()} whose customers may book here. A ${scopeWord()} has one scheduler per reason to meet — handover, site visit, maintenance — so the same ${scopeWord()} appears as often as it has reasons.`,
                  col: 6,
              },
          ]
        : []

    const schedulerShowSections = [
        { title: scope?.label ?? 'Reason', fields: [...(scope ? [scope.field] : []), 'label', 'label_ar', 'kind', 'created_at'] },
        { title: 'Visit Period, and Who May Book', fields: ['active', 'show_in_mobile_app', 'starts_on', 'ends_on'] },
        {
            // What bounds the calendar. What cuts it (length, pace, gap, cap, staff) lives on "Days & Hours".
            title: 'Booking Rules',
            fields: [
                'lead_time_days',
                'lead_time_working_days',
                'horizon_days',
                'max_active_appointments',
                'max_appointments_total',
                'allow_cancellation',
                'cancellation_notice_hours',
                'allow_reschedule',
                'reschedule_notice_hours',
                'max_reschedules',
            ],
        },
        { title: 'Customer Facing', fields: ['location', 'location_ar', 'instructions', 'instructions_ar'] },
    ]
    const schedulerFormSections = [
        ...schedulerShowSections.map((section, index) => (index === 0 ? { ...section, fields: section.fields.filter((f) => f !== 'created_at') } : section)),
        { title: 'Days & Hours', fields: ['windows'] },
        { title: 'Closures', fields: ['blocks'] },
    ]
    const on = subject ? ` on the same ${subjectWord()}` : ''

    register({
        name: names.schedulers,
        model: models.Scheduler,
        crud: ['list', 'show', 'create', 'update', 'delete'],
        exportable: true,
        actions: [],
        meta: {
            label: 'Scheduler',
            labelPlural: 'Schedulers',
            icon: 'calendar-check',
            description: scope ? `One per reason a ${scopeWord()} receives its customers` : 'One per reason to receive customers',
            group,
            order: 2,
            showInDashboard: true,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            ...scopeField,
            {
                name: 'label',
                type: 'string',
                label: 'Reason shown to the customer',
                required: true,
                searchable: true,
                sortable: true,
                helpText: `What the customer picks in the app before seeing a calendar — "Handover appointment", "Site visit", "Maintenance".${
                    scope ? ` Two reasons of the same ${scopeWord()} must not share it.` : ''
                }`,
                col: 6,
            },
            {
                name: 'label_ar',
                type: 'string',
                label: 'Name in Arabic',
                searchable: true,
                helpText: 'Same title for customers using the app in Arabic. Left empty, they see the English one.',
                col: 6,
            },
            {
                name: 'kind',
                type: 'select',
                label: 'Kind',
                required: true,
                filterable: true,
                options: KIND_OPTIONS,
                helpText: 'What sort of appointment this is, for sorting and reports. The app shows the reason above, not this.',
                col: 6,
            },
            {
                name: 'active',
                type: 'boolean',
                label: 'Bookings open',
                filterable: true,
                helpText: 'Master switch. Turned off, no slot at all is offered for this reason.',
                col: 4,
            },
            {
                name: 'show_in_mobile_app',
                type: 'boolean',
                label: 'Visible in the mobile app',
                filterable: true,
                helpText: `Hides this reason from the app while keeping everything configured here. Useful to prepare a ${scopeWord()} before opening it.`,
                col: 4,
            },
            {
                name: 'starts_on',
                type: 'date',
                label: 'First day visits happen',
                helpText:
                    'Optional. The first day an appointment can take place — no earlier date is ever offered. It is not the day booking opens: customers reserve it in advance, as soon as it enters the window below. Leave empty and visits can start today.',
                col: 6,
            },
            {
                name: 'ends_on',
                type: 'date',
                label: 'Last day visits happen',
                helpText: 'Optional. The last day an appointment can take place, included. Past it the reason offers nothing and disappears from the app. Leave empty to run with no end.',
                col: 6,
            },
            {
                name: 'lead_time_days',
                type: 'integer',
                // The model's default: left blank, the form would send null to a NOT NULL column.
                defaultValue: 1,
                label: 'Book at the latest (days) before the visit',
                helpText:
                    'How much warning the team needs. 14 means nothing in the next two weeks is offered any more — a customer who books today is received in fifteen days at the earliest.',
                col: 6,
            },
            {
                name: 'lead_time_working_days',
                type: 'boolean',
                label: 'Count that notice in working days',
                helpText: workingDaysHelp(weekend),
                col: 6,
            },
            {
                name: 'horizon_days',
                type: 'integer',
                defaultValue: 60,
                label: 'Book at the earliest (days) before the visit',
                helpText:
                    'The far edge of the window: how early a visit day can be reserved. With 30, a visit on 10 September starts being offered around 11 August, and only days inside the visit period are ever offered.',
                col: 6,
            },
            // What one customer may take, counted per subject: two flats are two handovers.
            {
                name: 'max_active_appointments',
                type: 'integer',
                label: 'Appointments a customer may hold at once',
                min: 0,
                helpText: `Counted${subject ? ` per ${subjectWord()}` : ''}, on what is still ahead. 1 means the customer books again only once the current visit is over, cancelled or past. Leave empty for no limit.`,
                col: 6,
            },
            {
                name: 'max_appointments_total',
                type: 'integer',
                label: 'Appointments a customer may ever book',
                min: 0,
                helpText: `The lifetime count${on}. 1 is the handover case: one visit, never a second. Cancelled appointments are not counted, a no-show is. Leave empty for no limit.`,
                col: 6,
            },
            {
                name: 'allow_cancellation',
                type: 'boolean',
                label: 'Customer may cancel the appointment',
                filterable: true,
                helpText:
                    'Turned off, the app offers no cancel button at all and the customer has to call the support. Turned on, the notice below says how late they may still do it.',
                col: 12,
            },
            {
                name: 'cancellation_notice_hours',
                type: 'integer',
                defaultValue: 48,
                label: 'Cancel until (hours) before',
                showIf: { field: 'allow_cancellation', operator: 'truthy' },
                helpText: 'Past that point the app refuses to cancel. 0 lets the customer cancel right up to the appointment.',
                col: 4,
            },
            {
                name: 'allow_reschedule',
                type: 'boolean',
                label: 'Customer may move the appointment',
                filterable: true,
                helpText: 'Moving releases the old slot and takes another one. Turned off, only the support can change a time.',
                col: 12,
            },
            {
                name: 'reschedule_notice_hours',
                type: 'integer',
                defaultValue: 48,
                label: 'Move until (hours) before',
                showIf: { field: 'allow_reschedule', operator: 'truthy' },
                helpText: 'Its own notice, not the cancellation one. Measured on the appointment being left, so a late move cannot empty tomorrow by aiming at next month.',
                col: 4,
            },
            {
                name: 'max_reschedules',
                type: 'integer',
                label: 'How many times an appointment may be moved',
                showIf: { field: 'allow_reschedule', operator: 'truthy' },
                helpText: 'Counted per appointment. Leave empty for no limit.',
                col: 4,
            },
            {
                name: 'location',
                type: 'string',
                label: 'Where the customer should go',
                helpText: `Shown in the app, e.g. "Sales office, gate 2".${subject ? ` Leave empty if the appointment happens at the ${subjectWord()}.` : ''}`,
                col: 6,
            },
            {
                name: 'location_ar',
                type: 'string',
                label: 'Where the customer should go (Arabic)',
                helpText: 'For customers using the app in Arabic. Left empty, they see the English one.',
                col: 6,
            },
            {
                name: 'instructions',
                type: 'text',
                label: 'What the customer should know',
                helpText: 'Shown on the confirmation screen — documents to bring, who to ask for at the gate…',
            },
            {
                name: 'instructions_ar',
                type: 'text',
                label: 'What the customer should know (Arabic)',
                helpText: 'For customers using the app in Arabic. Left empty, they see the English one.',
            },
            // A scheduler in another zone or with another weekend than the leaf's: out of the views, `extend` adds them.
            { name: 'timezone', type: 'string', label: 'Time zone', helpText: `The zone its hours are written in. Empty: ${tz}.` },
            {
                name: 'weekend_days',
                type: 'multiselect',
                label: 'Weekend',
                options: weekdayOptions(weekend),
                helpText: 'The days a notice in working days skips. Empty: the leaf’s weekend.',
            },
            {
                name: 'windows',
                type: 'hasMany',
                label: 'Days & hours',
                helpText:
                    'Everything a slot is made of. One card per opening: the days it covers, the hours, the pace, and who holds it — "Tuesday and Thursday, 09:00 to 12:00, 60 minutes, Ahmed". Two cards on the same day are fine and each keeps its own rules. Without a single card, nothing is ever offered.',
                hasMany: {
                    collection: names.windows,
                    foreignKey: 'scheduler_id',
                    fields: ['weekdays', 'start_minute', 'end_minute', 'duration_minutes', 'slot_step_minutes', 'gap_minutes', 'max_per_day', 'agents'],
                    layout: 'card',
                    addLabel: 'Add an opening',
                    deleteConfirm: 'Remove this opening? Appointments already booked inside it are kept.',
                },
            },
            {
                name: 'blocks',
                type: 'hasMany',
                label: 'Closures & holidays',
                helpText: `Days this ${scope ? scopeWord() : 'reason'} is closed for this reason — Eid, a national holiday, a site shutdown. One employee away is not a closure; that goes on their own record, under "Time off".`,
                hasMany: {
                    collection: names.blocks,
                    foreignKey: 'scheduler_id',
                    // No `agent_id`: here a closure holds for everyone.
                    fields: ['day', 'start_minute', 'end_minute', 'reason'],
                    layout: 'row',
                    addLabel: 'Add a closure',
                    paginate: true,
                    pageSize: 20,
                },
            },
            { name: 'created_at', type: 'datetime', label: 'Created', readonly: true, sortable: true },
        ],
        views: {
            list: {
                fields: ['id', ...(scope ? [scope.field] : []), 'label', 'kind', 'active', 'show_in_mobile_app', 'starts_on', 'ends_on'],
                sort: { field: 'id', direction: 'desc' },
                search: ['label', 'label_ar'],
                filters: [...(scope ? [scope.field] : []), 'active', 'show_in_mobile_app', 'kind'],
                include: scopeInclude,
            },
            show: { layout: 'tabs', sections: schedulerShowSections, include: scopeInclude },
            create: { layout: 'tabs', sections: schedulerFormSections },
            edit: { layout: 'tabs', sections: schedulerFormSections },
        },
    })

    // ============================================
    // Openings (days and hours). Out of the menu: edited on their scheduler's
    // page; their own page is where their staff is picked.
    // ============================================
    const windowSections = [
        { title: 'When', fields: ['scheduler_id', 'weekdays', 'start_minute', 'end_minute'] },
        { title: 'Slot Rules', fields: ['duration_minutes', 'slot_step_minutes', 'gap_minutes', 'max_per_day'] },
        { title: 'Employees', fields: ['agents'] },
    ]

    register({
        name: names.windows,
        model: models.SchedulerWindow,
        crud: ['list', 'show', 'create', 'update', 'delete'],
        exportable: true,
        meta: {
            label: 'Opening Hours',
            labelPlural: 'Opening Hours',
            icon: 'clock',
            description: 'Which weekdays are open, between which hours, and under which rules',
            group,
            order: 3,
            hidden: true,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            {
                name: 'scheduler_id',
                type: 'relation',
                label: 'Scheduler',
                required: true,
                filterable: true,
                relation: { collection: names.schedulers, displayField: 'label' },
                helpText: 'The reason this range belongs to. Filled in on its own when the range is added from a scheduler page.',
                col: 12,
            },
            {
                name: 'weekdays',
                type: 'multiselect',
                label: 'Days',
                required: true,
                filterable: true,
                options: weekdayOptions(weekend),
                helpText:
                    'Tick every day that follows this exact schedule — "Tuesday and Thursday, 09:00 to 12:00" is one card, not two. A different time or a different employee means another card.',
                col: 12,
            },
            { name: 'start_minute', type: 'time', label: 'Opens at', required: true, helpText: 'When the day opens — 09:00.', col: 6 },
            {
                name: 'end_minute',
                type: 'time',
                label: 'Closes at',
                required: true,
                helpText: 'When it closes — 17:00. The last appointment offered is the one that still ends before this.',
                col: 6,
            },
            // Short labels: they are also the columns of the openings' table on the scheduler page.
            {
                name: 'duration_minutes',
                type: 'integer',
                label: 'Appointment length (min)',
                required: true,
                defaultValue: 60,
                helpText: 'Applies to this opening. Another card may run a different length — "Saturday mornings are 30 minutes".',
                col: 3,
            },
            {
                name: 'slot_step_minutes',
                type: 'integer',
                label: 'A start time every (min)',
                required: true,
                defaultValue: 30,
                helpText:
                    'How far apart the times shown to the customer are. 30 gives 9:00, 9:30, 10:00… Smaller than the duration is fine: the ones already taken disappear on their own.',
                col: 3,
            },
            {
                name: 'gap_minutes',
                type: 'integer',
                label: 'Gap around each (min)',
                required: true,
                defaultValue: 0,
                helpText: 'Travel or paperwork time. 15 means nothing else can be booked in the 15 minutes before and after an appointment. 0 to chain them back to back.',
                col: 3,
            },
            {
                name: 'max_per_day',
                type: 'integer',
                label: 'Max per opening',
                helpText: 'Caps this range alone: the afternoon stays open once the morning has had its share. Leave empty for no cap of its own.',
                col: 3,
            },
            {
                name: 'agents',
                type: 'belongsToMany',
                label: 'Employees',
                required: true,
                helpText: `Who receives the appointments booked here — "Saturday morning is Ahmed and Fatima". Nobody picked, nothing is offered: there is no ${scopeWord()}-wide list to fall back on.`,
                belongsToMany: {
                    model: models.Agent,
                    through: models.SchedulerWindowHost,
                    foreignKey: 'scheduler_window_id',
                    otherKey: 'agent_id',
                    collection: names.agents,
                    displayField: 'first_name',
                    secondaryField: 'email',
                    searchable: true,
                    searchFields: ['first_name', 'last_name', 'email'],
                    layout: 'chips',
                },
            },
        ],
        views: {
            list: {
                fields: ['id', 'scheduler_id', 'weekdays', 'start_minute', 'end_minute', 'duration_minutes', 'slot_step_minutes', 'max_per_day'],
                sort: { field: 'start_minute', direction: 'asc' },
                filters: ['scheduler_id'],
                include: [{ association: 'scheduler', attributes: ['id', 'label'] }],
            },
            show: { layout: 'sections', sections: windowSections, include: [{ association: 'scheduler', attributes: ['id', 'label'] }] },
            create: { layout: 'sections', sections: windowSections },
            edit: { layout: 'sections', sections: windowSections },
        },
    })

    // ============================================
    // Closures and holidays. Out of the menu: set from the scheduler's page or the employee's.
    // ============================================
    const blockIncludes = [
        { association: 'agent', attributes: ['id', 'first_name', 'last_name', 'email'] },
        { association: 'scheduler', attributes: ['id', 'label'] },
    ]

    register({
        name: names.blocks,
        model: models.SchedulerBlock,
        crud: ['list', 'show', 'create', 'update', 'delete'],
        exportable: true,
        meta: {
            label: 'Closure',
            labelPlural: 'Closures & Holidays',
            icon: 'calendar-x',
            description: 'Days off, for one employee, one scheduler, or everyone',
            group,
            order: 5,
            hidden: true,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            {
                name: 'day',
                type: 'date',
                label: 'Day',
                required: true,
                filterable: true,
                sortable: true,
                helpText: `The closed day, read in ${tz} time. One row per day — a week off is seven rows.`,
                col: 6,
            },
            {
                name: 'agent_id',
                type: 'relation',
                label: 'Employee',
                filterable: true,
                relation: { collection: names.agents, displayField: 'email' },
                helpText: 'Leave empty to close the day for everyone.',
                col: 6,
            },
            {
                name: 'scheduler_id',
                type: 'relation',
                label: 'Scheduler',
                filterable: true,
                relation: { collection: names.schedulers, displayField: 'label' },
                helpText: 'Leave empty to close the day on every scheduler.',
                col: 6,
            },
            {
                name: 'reason',
                type: 'string',
                label: 'Reason',
                searchable: true,
                helpText: 'For the back-office only — the customer never reads it, they simply see no slot that day.',
                col: 6,
            },
            { name: 'start_minute', type: 'time', label: 'From (Time)', helpText: 'Leave both empty to block the whole day.', col: 6 },
            {
                name: 'end_minute',
                type: 'time',
                label: 'To (Time)',
                helpText: 'End of the closed stretch. Only the slots inside it disappear; the rest of the day stays open.',
                col: 6,
            },
        ],
        views: {
            list: {
                fields: ['id', 'day', 'agent_id', 'scheduler_id', 'start_minute', 'end_minute', 'reason'],
                sort: { field: 'day', direction: 'desc' },
                search: ['reason'],
                filters: ['day', 'agent_id', 'scheduler_id'],
                include: blockIncludes,
            },
            show: {
                layout: 'sections',
                sections: [
                    { title: 'When', fields: ['day', 'start_minute', 'end_minute'] },
                    { title: 'Scope', fields: ['agent_id', 'scheduler_id', 'reason'] },
                ],
                include: blockIncludes,
            },
            create: { fields: ['day', 'agent_id', 'scheduler_id', 'start_minute', 'end_minute', 'reason'] },
            edit: { fields: ['day', 'agent_id', 'scheduler_id', 'start_minute', 'end_minute', 'reason'] },
        },
    })

    // ============================================
    // Appointments. `create` is open because a customer sometimes calls
    // instead of opening the app: the `booking:appointment-booking` hook runs
    // the input through the engine, as a booking from the phone.
    // ============================================
    const subjectRelation = subject?.collection
        ? { collection: subject.collection, displayField: subjectDisplay, secondaryField: subject.secondaryField, searchable: true }
        : undefined
    // The shared back-office's slot picker reads the subject as `property_id`:
    // a VIRTUAL alias on the project's model when its column has another name.
    const aliased = !!subject && subject.field !== BO_SUBJECT_FIELD
    const subjectFields = subject
        ? [
              ...(aliased
                  ? [
                        {
                            name: subject.field,
                            type: 'relation',
                            label: subjectLabel,
                            filterable: true,
                            readonly: true,
                            relation: subjectRelation,
                            helpText: `The ${subjectWord()} the visit is about, when there is one. Fixed once saved.`,
                        },
                    ]
                  : []),
              {
                  name: BO_SUBJECT_FIELD,
                  type: 'relation',
                  label: subjectLabel,
                  required: true,
                  ...(aliased ? {} : { filterable: true }),
                  relation: subjectRelation,
                  helpText: `The ${subjectWord()} the visit is about. It decides which ${scopeWord()}, so which reasons and times, apply — pick it before the time.`,
              },
          ]
        : []
    const shownSubject = subject ? [subject.field] : []
    const appointmentIncludes = [
        ...(customerAs ? [{ association: customerAs, attributes: ['id', customers.displayField] }] : []),
        ...(subjectAs ? [{ association: subjectAs, attributes: ['id', subjectDisplay] }] : []),
        { association: 'agent', attributes: ['id', 'email', 'first_name', 'last_name'] },
        { association: 'scheduler', attributes: ['id', 'label'] },
    ]

    register({
        name: names.appointments,
        model: models.BookingAppointment,
        crud: ['list', 'show', 'create', 'update'],
        actions: [CANCEL_ACTION],
        exportable: true,
        meta: {
            label: 'Booking',
            labelPlural: 'Bookings',
            icon: 'calendar',
            description: 'Visits booked through the booking system',
            group,
            order: 1,
            showInDashboard: true,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            {
                // The slots the scheduler really offers; a free picker once "Book
                // outside the rules" is ticked. Not `readonly`, or it would leave
                // the create form: the hook forbids moving it.
                name: 'starts_at',
                type: 'slot-picker',
                label: 'Starts at',
                required: true,
                sortable: true,
                helpText: 'Pick one of the times the scheduler actually offers. Once saved it cannot be moved — cancel and book again.',
            },
            {
                name: 'ends_at',
                type: 'datetime',
                label: 'Ends at',
                readonly: true,
                helpText: 'Start plus the length that applied when it was booked. Changing the scheduler afterwards does not move it.',
            },
            {
                name: 'duration_minutes',
                type: 'integer',
                label: 'How long it lasts (minutes)',
                min: 5,
                max: 480,
                // Outside the rules no opening gives the length: it must be said.
                showIf: { field: 'override_rules', operator: 'truthy' },
                helpText: 'Only used when you book outside the rules — otherwise the opening hours decide. Left empty, an out-of-hours appointment lasts 60 minutes.',
            },
            {
                name: 'status',
                type: 'select',
                label: 'Status',
                filterable: true,
                helpText: 'Only "Scheduled" holds a slot. Cancelling frees it immediately; "No Show" keeps the history without freeing anything.',
                options: STATUS_OPTIONS,
            },
            {
                name: 'notes',
                type: 'text',
                label: 'Notes',
                searchable: true,
                helpText: 'What the customer typed when booking, plus anything the team adds afterwards.',
            },
            hasCustomers
                ? {
                      name: 'user_id',
                      type: 'relation',
                      label: 'Customer',
                      required: true,
                      filterable: true,
                      relation: { collection: customers.collection, displayField: customers.displayField, secondaryField: customerSecondary, searchable: true },
                      helpText: 'The account the visit is for. It cannot be changed afterwards — a different customer means a different appointment.',
                  }
                : { name: 'user_id', type: 'integer', label: 'Customer', required: true, filterable: true },
            ...subjectFields,
            {
                // A relation for the list and filters, a widget for the input: only the employees free at the time picked.
                name: 'agent_id',
                type: 'relation',
                widget: 'slot-agent',
                label: 'Employee',
                filterable: true,
                relation: { collection: names.agents, displayField: 'email', secondaryField: 'first_name', searchable: true },
                helpText:
                    "Only the employees free at the time you picked are offered — they come from this scheduler's openings, not from the whole company. Leave it empty and the least loaded of them takes the visit.",
            },
            {
                // A form field, not a column: the hook takes it out before writing.
                name: 'override_rules',
                type: 'boolean',
                label: 'Book outside the rules',
                defaultValue: false,
                helpText:
                    'Ignore the opening hours, the closures, the notice period and the per-owner limits. Two appointments on the same employee at the same time stay refused whatever happens.',
            },
            {
                // The widget offers only the reasons of the chosen subject's scope.
                name: 'scheduler_id',
                type: 'relation',
                widget: 'slot-reason',
                label: 'What the visit is for',
                required: true,
                filterable: true,
                relation: { collection: names.schedulers, displayField: 'label' },
                helpText:
                    'The reason the customer is being received — handover, site visit, maintenance. Each one has its own hours, team and notice period, so it decides which times exist below. Fixed once saved.',
            },
            { name: 'cancelled_at', type: 'datetime', label: 'Cancelled at', readonly: true, helpText: 'Empty as long as the appointment stands.' },
            {
                name: 'cancellation_reason',
                type: 'string',
                label: 'Reason given',
                readonly: true,
                helpText: 'What the customer typed when cancelling, or what the back-office recorded.',
            },
            {
                name: 'rescheduled_at',
                type: 'datetime',
                label: 'Last moved at',
                readonly: true,
                helpText: 'When the customer last changed the time. Empty if it never moved.',
            },
            {
                name: 'reschedule_count',
                type: 'integer',
                label: 'Reschedules',
                readonly: true,
                sortable: true,
                helpText: 'How many times the customer moved this appointment.',
            },
            { name: 'created_at', type: 'datetime', label: 'Created', readonly: true, sortable: true },
        ],
        views: {
            list: {
                fields: ['id', 'starts_at', 'duration_minutes', 'status', 'user_id', ...shownSubject, 'agent_id', 'scheduler_id'],
                sort: { field: 'starts_at', direction: 'desc' },
                search: ['notes'],
                filters: ['status', 'user_id', 'agent_id', ...shownSubject, 'scheduler_id'],
                include: appointmentIncludes,
            },
            show: {
                layout: 'sections',
                sections: [
                    { title: 'Visit', fields: ['starts_at', 'ends_at', 'duration_minutes', 'scheduler_id', 'notes'] },
                    { title: 'Status', fields: ['status', 'cancelled_at', 'cancellation_reason', 'rescheduled_at', 'reschedule_count'] },
                    { title: 'Relations', fields: ['user_id', ...shownSubject, 'agent_id', 'created_at'] },
                ],
                include: appointmentIncludes,
            },
            // The order of the decision: the subject names the scope, the scope
            // lists its reasons, the reason gives hours and team, the time says who is free.
            create: {
                fields: ['user_id', ...(subject ? [BO_SUBJECT_FIELD] : []), 'scheduler_id', 'override_rules', 'starts_at', 'duration_minutes', 'agent_id', 'notes'],
            },
            edit: { fields: ['status', 'agent_id', 'notes'] },
        },
    })

    // ============================================
    // Agents: the employees who receive the appointments.
    // ============================================
    const agentAccount = models.Agent.rawAttributes?.user_id
        ? [
              hasCustomers
                  ? {
                        name: 'user_id',
                        type: 'relation',
                        label: 'App Account',
                        filterable: true,
                        relation: { collection: customers.collection, displayField: customers.displayField },
                        helpText: 'Optional. Only for agents who also have an account in the app.',
                        col: 6,
                    }
                  : { name: 'user_id', type: 'integer', label: 'App Account', col: 6 },
          ]
        : []
    const agentForm = ['first_name', 'last_name', 'email', 'phone_number', 'active', 'max_concurrent_appointments', ...agentAccount.map((f) => f.name), 'holidays']

    register({
        name: names.agents,
        model: models.Agent,
        crud: ['list', 'show', 'create', 'update', 'delete'],
        exportable: true,
        meta: {
            label: 'Agent',
            labelPlural: 'Agents',
            icon: 'user-check',
            description: 'Employees who receive appointments',
            group,
            order: 4,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            { name: 'first_name', type: 'string', label: 'First Name', required: true, searchable: true, col: 6 },
            { name: 'last_name', type: 'string', label: 'Last Name', required: true, searchable: true, col: 6 },
            { name: 'email', type: 'email', label: 'Email', required: true, searchable: true, sortable: true, col: 6 },
            { name: 'phone_number', type: 'phone', label: 'Phone', searchable: true, col: 6 },
            {
                name: 'active',
                type: 'boolean',
                label: 'Active',
                filterable: true,
                helpText: 'Unchecked, this agent disappears from every scheduler at once.',
                col: 6,
            },
            ...agentAccount,
            {
                name: 'max_concurrent_appointments',
                type: 'integer',
                label: 'Concurrent appointments',
                helpText:
                    'How many customers this employee can receive at the same time. 1 is the usual case. It caps simultaneous appointments, not the day: use "Max per opening" on a time range for that.',
                col: 6,
            },
            {
                // Their time off: without `scheduler_id`, a row here holds on every scheduler.
                name: 'holidays',
                type: 'hasMany',
                label: 'Time off',
                helpText:
                    'Days this employee is away — leave, training, sick day. Their slots disappear on every scheduler at once. One row per day: a week off is seven rows. Leave both times empty for the whole day, or fill them to free only a stretch of it.',
                hasMany: {
                    collection: names.blocks,
                    foreignKey: 'agent_id',
                    fields: ['day', 'start_minute', 'end_minute', 'reason'],
                    layout: 'row',
                    addLabel: 'Add a day off',
                    deleteConfirm: 'Remove this day off? Slots come back on that day.',
                    paginate: true,
                    pageSize: 20,
                },
            },
        ],
        views: {
            list: {
                fields: ['id', 'first_name', 'last_name', 'email', 'phone_number', 'max_concurrent_appointments', 'active'],
                sort: { field: 'id', direction: 'desc' },
                search: ['first_name', 'last_name', 'email'],
                filters: ['active'],
            },
            show: {
                layout: 'sections',
                sections: [
                    { title: 'Identity', fields: ['first_name', 'last_name', 'email', 'phone_number'] },
                    { title: 'Scheduling', fields: ['active', 'max_concurrent_appointments', ...agentAccount.map((f) => f.name)] },
                ],
                collections: [
                    {
                        name: names.appointments,
                        title: 'Appointments',
                        model: models.BookingAppointment,
                        foreignKey: 'agent_id',
                        fields: ['id', 'starts_at', 'duration_minutes', 'status', 'user_id', ...shownSubject],
                        sort: { field: 'starts_at', direction: 'desc' },
                        limit: 20,
                    },
                ],
            },
            create: { fields: agentForm },
            edit: { fields: agentForm },
        },
    })
}
