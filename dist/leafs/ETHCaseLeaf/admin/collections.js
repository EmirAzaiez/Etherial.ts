import { CaseCannedReply } from '../models/CaseCannedReply.js';
import { CaseEvent, CaseEventType } from '../models/CaseEvent.js';
import { CaseSlaPolicy } from '../models/CaseSlaPolicy.js';
import { ASSIGN_TO_ME_ACTION } from './features.js';
import { ADMIN_PREFIX, CANNED_REPLIES_COLLECTION, CASES_COLLECTION, COMMENTS_COLLECTION, EVENTS_COLLECTION, SLA_POLICIES_COLLECTION, caseModels, categoriesOf, customersOf, kindsOf, prioritiesOf, state, wordsOf, } from '../services/options.js';
import { ATTENTION_OPTIONS, CaseAttention, OPEN_CASE_STATUSES, statusOptions } from '../services/statuses.js';
/**
 * The cases' back-office, in one sidebar group ("Support"): the inbox, the
 * messages, the canned replies, the response times and the history. The
 * conversation itself is the back-office's panel (`routes/admin.ts`). A
 * collection the project already registered is left alone; `admin.extend`
 * changes one before it is registered.
 */
const EVENT_OPTIONS = [
    { value: CaseEventType.CREATED, label: 'Opened', color: 'blue' },
    { value: CaseEventType.STATUS, label: 'Status', color: 'blue' },
    { value: CaseEventType.REOPENED, label: 'Reopened', color: 'orange' },
    { value: CaseEventType.ASSIGNED, label: 'Assigned', color: 'purple' },
    { value: CaseEventType.PRIORITY, label: 'Priority', color: 'gray' },
    { value: CaseEventType.CATEGORY, label: 'Category', color: 'gray' },
    { value: CaseEventType.KIND, label: 'Type', color: 'gray' },
    { value: CaseEventType.CONFIRMED, label: 'Confirmed', color: 'green' },
    { value: CaseEventType.REJECTED, label: 'Not fixed', color: 'red' },
    { value: CaseEventType.RATED, label: 'Rated', color: 'green' },
    { value: CaseEventType.OVERDUE, label: 'Overdue', color: 'red' },
];
export function registerCaseCollections(adminLeaf) {
    var _a, _b, _c, _d, _e, _f;
    const config = state.config;
    const group = (_b = (_a = config.admin) === null || _a === void 0 ? void 0 : _a.group) !== null && _b !== void 0 ? _b : 'Support';
    const words = wordsOf();
    const caseWord = words.case.toLowerCase();
    const customerWord = words.customer.toLowerCase();
    const customers = customersOf();
    const subject = config.subject;
    const { Case, CaseComment } = caseModels();
    const register = (collection) => {
        var _a, _b, _c, _d;
        if ((_a = adminLeaf.getCollection) === null || _a === void 0 ? void 0 : _a.call(adminLeaf, collection.name))
            return;
        adminLeaf.registerCollection((_d = (_c = (_b = config.admin) === null || _b === void 0 ? void 0 : _b.extend) === null || _c === void 0 ? void 0 : _c.call(_b, collection.name, collection)) !== null && _d !== void 0 ? _d : collection);
    };
    // ============================================
    // Cases: the inbox. Staff handle a case from its page, where the
    // conversation panel answers; the form changes status, priority, assignee.
    // ============================================
    const subjectField = subject
        ? [
            subject.collection
                ? {
                    name: subject.field,
                    type: 'relation',
                    label: (_c = subject.label) !== null && _c !== void 0 ? _c : 'About',
                    readonly: true,
                    filterable: true,
                    relation: { collection: subject.collection, displayField: (_d = subject.displayField) !== null && _d !== void 0 ? _d : 'name' },
                }
                : { name: subject.field, type: 'integer', label: (_e = subject.label) !== null && _e !== void 0 ? _e : 'About', readonly: true, filterable: true },
        ]
        : [];
    register({
        name: CASES_COLLECTION,
        model: Case,
        crud: ['list', 'show', 'update'],
        exportable: true,
        actions: [ASSIGN_TO_ME_ACTION],
        meta: {
            label: words.case,
            labelPlural: words.cases,
            icon: 'life-buoy',
            description: `Maintenance, complaints and questions from ${customerWord}s: answer, assign, resolve.`,
            group,
            order: 0,
            showInDashboard: true,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            { name: 'reference', type: 'string', label: 'Reference', readonly: true, searchable: true, sortable: true },
            {
                name: 'user_id',
                type: 'relation',
                label: words.customer,
                readonly: true,
                filterable: true,
                relation: { collection: customers.collection, displayField: customers.displayField },
            },
            ...subjectField,
            { name: 'kind', type: 'select', label: 'Type', readonly: true, filterable: true, options: kindsOf() },
            { name: 'subject', type: 'string', label: 'Subject', readonly: true, searchable: true },
            { name: 'description', type: 'text', label: 'Description', readonly: true },
            { name: 'category', type: 'select', label: 'Category', filterable: true, options: categoriesOf() },
            { name: 'topic', type: 'string', label: 'Topic', readonly: true },
            { name: 'location', type: 'string', label: 'Location', readonly: true },
            {
                name: 'status',
                type: 'select',
                label: 'Status',
                filterable: true,
                sortable: true,
                helpText: `Resolved asks the ${customerWord} to confirm; both Resolved and Closed notify them.`,
                options: statusOptions(),
            },
            {
                name: 'attention',
                type: 'select',
                label: 'Needs',
                readonly: true,
                filterable: true,
                helpText: `Overdue: past its time to answer or to resolve (see Response Times). A reply: the ${customerWord} waits for an answer.`,
                options: ATTENTION_OPTIONS,
            },
            { name: 'priority', type: 'select', label: 'Priority', filterable: true, sortable: true, options: prioritiesOf() },
            { name: 'requested_priority', type: 'select', label: 'Priority asked', readonly: true, options: prioritiesOf() },
            {
                name: 'assigned_to_user_id',
                type: 'relation',
                label: 'Assigned to',
                filterable: true,
                helpText: 'Their alerts (answers, overdue) go to them; nobody assigned, they go to everyone handling these.',
                relation: { collection: customers.collection, displayField: customers.displayField },
            },
            { name: 'resolution_note', type: 'text', label: 'Resolution', helpText: `Shown to the ${customerWord} once resolved.` },
            { name: 'channel', type: 'string', label: 'Channel', readonly: true, filterable: true },
            { name: 'issues', type: 'json', label: 'Issues', readonly: true },
            { name: 'attachments', type: 'json', label: 'Photos', readonly: true },
            { name: 'confirmation_status', type: 'string', label: `${words.customer} confirmation`, readonly: true, filterable: true, badge: true },
            { name: 'confirmation_note', type: 'text', label: 'Confirmation note', readonly: true },
            { name: 'satisfaction_rating', type: 'integer', label: 'Rating', readonly: true, sortable: true },
            { name: 'satisfaction_note', type: 'text', label: 'Rating note', readonly: true },
            { name: 'reopened_count', type: 'integer', label: 'Reopened', readonly: true },
            { name: 'awaiting_reply_since', type: 'datetime', label: 'Waiting since', readonly: true, sortable: true },
            { name: 'first_response_due_at', type: 'datetime', label: 'Answer due', readonly: true, sortable: true },
            { name: 'resolution_due_at', type: 'datetime', label: 'Resolution due', readonly: true, sortable: true },
            { name: 'first_response_at', type: 'datetime', label: 'First Answer', readonly: true, sortable: true },
            { name: 'resolved_at', type: 'datetime', label: 'Resolved', readonly: true, sortable: true },
            { name: 'closed_at', type: 'datetime', label: 'Closed', readonly: true, sortable: true },
            { name: 'last_activity_at', type: 'datetime', label: 'Last Activity', readonly: true, sortable: true },
            { name: 'created_at', type: 'datetime', label: 'Created', readonly: true, sortable: true },
        ],
        views: {
            list: {
                fields: ['id', 'reference', 'kind', 'subject', 'user_id', 'status', 'attention', 'priority', 'assigned_to_user_id', 'last_activity_at'],
                sort: { field: 'created_at', direction: 'desc' },
                search: ['reference', 'subject'],
                filters: ['status', 'attention', 'kind', 'category', 'priority', 'assigned_to_user_id', 'channel', 'user_id'],
            },
            show: {
                layout: 'sections',
                sections: [
                    { title: words.case, fields: ['reference', 'kind', 'category', 'subject', 'description', 'topic', 'location', 'issues', 'attachments'] },
                    { title: 'Handling', fields: ['status', 'attention', 'priority', 'requested_priority', 'assigned_to_user_id', 'resolution_note'] },
                    { title: words.customer, fields: ['user_id', ...(subject ? [subject.field] : []), 'channel'] },
                    { title: 'Feedback', fields: ['confirmation_status', 'confirmation_note', 'satisfaction_rating', 'satisfaction_note', 'reopened_count'] },
                    {
                        title: 'Dates',
                        fields: [
                            'created_at',
                            'awaiting_reply_since',
                            'first_response_due_at',
                            'first_response_at',
                            'resolution_due_at',
                            'resolved_at',
                            'closed_at',
                            'last_activity_at',
                        ],
                    },
                ],
            },
            edit: {
                layout: 'sections',
                sections: [{ title: 'Handling', fields: ['status', 'priority', 'category', 'assigned_to_user_id', 'resolution_note'] }],
            },
        },
        stats: [
            { name: 'open', label: `Open ${words.cases.toLowerCase()}`, type: 'count', icon: 'life-buoy', color: 'warning', where: { status: OPEN_CASE_STATUSES }, global: true },
            { name: 'overdue', label: 'Overdue', type: 'count', icon: 'alarm-clock', color: 'danger', where: { attention: CaseAttention.OVERDUE }, global: true },
            { name: 'created', label: `New ${words.cases.toLowerCase()}`, type: 'timeline', icon: 'plus-circle', color: 'primary', dateField: 'created_at' },
        ],
    });
    // ============================================
    // Messages: the customer's and the staff's, internal notes included.
    // ============================================
    register({
        name: COMMENTS_COLLECTION,
        model: CaseComment,
        crud: ['list', 'show', 'create'],
        meta: {
            label: 'Message',
            labelPlural: `${words.case} Conversations`,
            icon: 'message-circle',
            description: `Messages on the ${words.cases.toLowerCase()}. A reply that is not internal notifies the ${customerWord}.`,
            group,
            order: 1,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            {
                name: 'case_id',
                type: 'relation',
                label: words.case,
                required: true,
                filterable: true,
                relation: { collection: CASES_COLLECTION, displayField: 'reference', secondaryField: 'subject' },
            },
            { name: 'body', type: 'text', label: 'Message', required: true, col: 12 },
            {
                name: 'internal',
                type: 'boolean',
                label: 'Internal note',
                defaultValue: false,
                filterable: true,
                helpText: `Kept between staff: the ${customerWord} neither sees it nor is notified.`,
            },
            {
                name: 'author_kind',
                type: 'select',
                label: 'Side',
                readonly: true,
                filterable: true,
                options: [
                    { value: 'staff', label: 'Staff', color: 'blue' },
                    { value: 'resident', label: words.customer, color: 'gray' },
                ],
            },
            { name: 'author_name', type: 'string', label: 'From', readonly: true },
            { name: 'author_user_id', type: 'relation', label: 'Account', readonly: true, relation: { collection: customers.collection, displayField: customers.displayField } },
            { name: 'attachments', type: 'json', label: 'Files', readonly: true },
            { name: 'created_at', type: 'datetime', label: 'Sent', readonly: true, sortable: true },
        ],
        views: {
            list: {
                fields: ['id', 'case_id', 'author_kind', 'author_name', 'body', 'internal', 'created_at'],
                sort: { field: 'created_at', direction: 'desc' },
                search: ['body'],
                filters: ['case_id', 'author_kind', 'internal'],
            },
            show: {
                layout: 'sections',
                sections: [{ title: 'Message', fields: ['case_id', 'author_kind', 'author_name', 'author_user_id', 'body', 'internal', 'attachments', 'created_at'] }],
            },
            create: { fields: ['case_id', 'body', 'internal'] },
        },
    });
    // ============================================
    // Canned replies: the answers staff give often, filled in for the case.
    // ============================================
    register({
        name: CANNED_REPLIES_COLLECTION,
        model: CaseCannedReply,
        crud: ['list', 'show', 'create', 'update', 'delete'],
        meta: {
            label: 'Canned Reply',
            labelPlural: 'Canned Replies',
            icon: 'message-square',
            description: `Answers given often, one click away in the conversation. Most used first.`,
            group,
            order: 2,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            { name: 'title', type: 'string', label: 'Title', required: true, searchable: true, sortable: true, helpText: 'What staff pick it by. The customer never sees it.' },
            {
                name: 'body',
                type: 'text',
                label: 'Text',
                required: true,
                col: 12,
                helpText: `Placeholders: {{customer_name}} (first name), {{reference}}, {{subject}}, {{staff_name}}. Staff can change the text before sending.`,
            },
            { name: 'kind', type: 'select', label: `For ${caseWord}s of type`, filterable: true, options: kindsOf(), helpText: 'Empty: offered on every type.' },
            { name: 'active', type: 'boolean', label: 'Offered', defaultValue: true, filterable: true },
            { name: 'used_count', type: 'integer', label: 'Used', readonly: true, sortable: true },
            { name: 'created_at', type: 'datetime', label: 'Created', readonly: true, sortable: true },
        ],
        views: {
            list: { fields: ['id', 'title', 'kind', 'active', 'used_count'], sort: { field: 'used_count', direction: 'desc' }, search: ['title', 'body'], filters: ['kind', 'active'] },
            show: { layout: 'sections', sections: [{ title: 'Canned Reply', fields: ['title', 'kind', 'active', 'body', 'used_count', 'created_at'] }] },
            create: { fields: ['title', 'kind', 'active', 'body'] },
            edit: { fields: ['title', 'kind', 'active', 'body'] },
        },
    });
    // ============================================
    // Response times (SLA): how fast a case must be answered and resolved.
    // ============================================
    const any = 'Empty: any.';
    register({
        name: SLA_POLICIES_COLLECTION,
        model: CaseSlaPolicy,
        crud: ['list', 'show', 'create', 'update', 'delete'],
        meta: {
            label: 'Response Time',
            labelPlural: 'Response Times',
            icon: 'timer',
            description: `How fast a ${caseWord} must be answered and resolved. The most precise rule that matches applies; none, no deadline.`,
            group,
            order: 3,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            { name: 'label', type: 'string', label: 'Name', required: true, searchable: true, sortable: true },
            { name: 'kind', type: 'select', label: 'Type', filterable: true, options: kindsOf(), helpText: any, col: 4 },
            { name: 'category', type: 'select', label: 'Category', filterable: true, options: categoriesOf(), helpText: any, col: 4 },
            { name: 'priority', type: 'select', label: 'Priority', filterable: true, options: prioritiesOf(), helpText: any, col: 4 },
            {
                name: 'first_response_hours',
                type: 'number',
                label: 'Answer within (hours)',
                col: 6,
                helpText: `From when the ${caseWord} opens to the first reply the ${customerWord} reads. Calendar hours.`,
            },
            {
                name: 'resolution_hours',
                type: 'number',
                label: 'Resolve within (hours)',
                col: 6,
                helpText: `From when it opens, or is reopened, to Resolved. Calendar hours; waiting on the ${customerWord} still counts.`,
            },
            { name: 'active', type: 'boolean', label: 'Applied', defaultValue: true, filterable: true },
            { name: 'created_at', type: 'datetime', label: 'Created', readonly: true, sortable: true },
        ],
        views: {
            list: { fields: ['id', 'label', 'kind', 'category', 'priority', 'first_response_hours', 'resolution_hours', 'active'], sort: { field: 'id', direction: 'asc' }, search: ['label'], filters: ['kind', 'category', 'priority', 'active'] },
            show: {
                layout: 'sections',
                sections: [
                    { title: 'Applies to', fields: ['label', 'kind', 'category', 'priority', 'active'] },
                    { title: 'Times', fields: ['first_response_hours', 'resolution_hours'] },
                ],
            },
            create: { fields: ['label', 'kind', 'category', 'priority', 'first_response_hours', 'resolution_hours', 'active'] },
            edit: { fields: ['label', 'kind', 'category', 'priority', 'first_response_hours', 'resolution_hours', 'active'] },
        },
    });
    // ============================================
    // History: what happened to each case, read in its conversation panel.
    // ============================================
    register({
        name: EVENTS_COLLECTION,
        model: CaseEvent,
        crud: ['list', 'show'],
        meta: {
            label: `${words.case} Event`,
            labelPlural: `${words.case} History`,
            icon: 'history',
            description: `Every change of status, assignee, priority, and the ${customerWord}'s answers.`,
            group,
            order: 4,
            hidden: true,
        },
        fields: [
            { name: 'id', type: 'integer', readonly: true, sortable: true },
            { name: 'case_id', type: 'relation', label: words.case, readonly: true, filterable: true, relation: { collection: CASES_COLLECTION, displayField: 'reference' } },
            { name: 'type', type: 'select', label: 'What', readonly: true, filterable: true, options: EVENT_OPTIONS },
            { name: 'from_value', type: 'string', label: 'From', readonly: true },
            { name: 'to_value', type: 'string', label: 'To', readonly: true },
            { name: 'note', type: 'text', label: 'Note', readonly: true },
            { name: 'actor_label', type: 'string', label: 'By', readonly: true },
            { name: 'actor_type', type: 'string', label: 'By (kind)', readonly: true, filterable: true },
            { name: 'source', type: 'string', label: 'Through', readonly: true, filterable: true },
            { name: 'created_at', type: 'datetime', label: 'When', readonly: true, sortable: true },
        ],
        views: {
            list: { fields: ['id', 'case_id', 'type', 'from_value', 'to_value', 'actor_label', 'created_at'], sort: { field: 'created_at', direction: 'desc' }, filters: ['case_id', 'type', 'source'] },
            show: { layout: 'sections', sections: [{ title: 'Event', fields: ['case_id', 'type', 'from_value', 'to_value', 'note', 'actor_label', 'actor_type', 'source', 'created_at'] }] },
        },
    });
    (_f = adminLeaf.setFeature) === null || _f === void 0 ? void 0 : _f.call(adminLeaf, 'cases', { collection: CASES_COLLECTION, commentsCollection: COMMENTS_COLLECTION, thread: ADMIN_PREFIX });
}
