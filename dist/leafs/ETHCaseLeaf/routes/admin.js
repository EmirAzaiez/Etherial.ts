var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from 'etherial';
import { Op } from 'sequelize';
import { Controller, Get, Post } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { CaseCannedReply } from '../models/CaseCannedReply.js';
import { CaseEvent, CaseEventType } from '../models/CaseEvent.js';
import { attachmentsFromMedia, cannedRepliesFor, replyToCase } from '../services/cases.js';
import { CASES_COLLECTION, COMMENTS_COLLECTION, attachmentFolders, attachmentsAllowed, caseModels, categoriesOf, customersOf, kindsOf, labelIn, prioritiesOf, projectModel, readOnlyReason, state, wordsOf, } from '../services/options.js';
import { ATTENTION_OPTIONS, statusOptions } from '../services/statuses.js';
const MAX_BODY = 10000;
const positiveId = (value) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
};
const adminLeaf = () => etherial.eth_admin_leaf;
/** Whether `user` may run `method` on a collection, from the back-office only. */
function allowed(user, collection, method) {
    return __awaiter(this, void 0, void 0, function* () {
        const admin = adminLeaf();
        if (!admin || !(yield admin.canAccessAdmin(user)))
            return false;
        return admin.checkAccess(user, collection, method);
    });
}
/** The people a thread names (customer, assignee, staff in the history), by id. */
function peopleLabels(ids) {
    return __awaiter(this, void 0, void 0, function* () {
        const wanted = [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
        const { model, displayField } = customersOf();
        const People = projectModel(model);
        if (!wanted.length || !People)
            return new Map();
        const rows = yield People.findAll({ where: { id: { [Op.in]: wanted } } });
        const label = (row) => {
            var _a, _b, _c, _d;
            const name = [(_a = row.first_name) !== null && _a !== void 0 ? _a : row.firstname, (_b = row.last_name) !== null && _b !== void 0 ? _b : row.lastname].filter(Boolean).join(' ').trim();
            return name || String((_d = (_c = row[displayField]) !== null && _c !== void 0 ? _c : row.email) !== null && _d !== void 0 ? _d : `#${row.id}`);
        };
        return new Map(rows.map((row) => [row.id, label(row)]));
    });
}
/** "Status: New → In progress", as staff read it. */
function eventText(event, people) {
    const from = event.from_value;
    const to = event.to_value;
    const person = (id) => { var _a; return (id ? ((_a = people.get(Number(id))) !== null && _a !== void 0 ? _a : `#${id}`) : 'nobody'); };
    const change = (list) => `${labelIn(list, from) || '—'} → ${labelIn(list, to) || '—'}`;
    switch (event.type) {
        case CaseEventType.CREATED:
            return `${wordsOf().case} opened`;
        case CaseEventType.STATUS:
            return `Status: ${change(statusOptions())}`;
        case CaseEventType.REOPENED:
            return `Reopened: ${change(statusOptions())}`;
        case CaseEventType.ASSIGNED:
            return to ? `Assigned to ${person(to)}` : `Unassigned (was ${person(from)})`;
        case CaseEventType.PRIORITY:
            return `Priority: ${change(prioritiesOf())}`;
        case CaseEventType.CATEGORY:
            return `Category: ${change(categoriesOf())}`;
        case CaseEventType.KIND:
            return `Type: ${change(kindsOf())}`;
        case CaseEventType.CONFIRMED:
            return `The ${wordsOf().customer.toLowerCase()} confirmed it is fixed`;
        case CaseEventType.REJECTED:
            return `The ${wordsOf().customer.toLowerCase()} says it is not fixed`;
        case CaseEventType.RATED:
            return `Rated ${to}/5`;
        case CaseEventType.OVERDUE:
            return to === 'first_response' ? 'Overdue: no answer in time' : 'Overdue: not resolved in time';
        default:
            return event.type;
    }
}
function messageItem(comment) {
    var _a;
    return {
        type: 'message',
        id: comment.id,
        at: comment.created_at,
        author_kind: comment.author_kind,
        author_name: comment.author_name,
        author_user_id: comment.author_user_id,
        body: comment.body,
        internal: !!comment.internal,
        attachments: (_a = comment.attachments) !== null && _a !== void 0 ? _a : [],
    };
}
function eventItem(event, people) {
    var _a;
    return {
        type: 'event',
        id: event.id,
        at: event.created_at,
        event: event.type,
        text: eventText(event, people),
        note: event.note,
        actor: (_a = event.actor_label) !== null && _a !== void 0 ? _a : (event.actor_type === 'user' ? null : event.actor_type),
        source: event.source,
    };
}
/** What the panel shows above the conversation. */
function caseSummary(kase, people) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const subject = state.config.subject;
    const status = statusOptions().find((o) => o.value === kase.status);
    return {
        id: kase.id,
        reference: kase.reference,
        subject: kase.subject,
        description: kase.description,
        kind: { value: kase.kind, label: labelIn(kindsOf(), kase.kind) },
        category: { value: kase.category, label: labelIn(categoriesOf(), kase.category) },
        priority: { value: kase.priority, label: labelIn(prioritiesOf(), kase.priority) },
        status: { value: kase.status, label: (_a = status === null || status === void 0 ? void 0 : status.label) !== null && _a !== void 0 ? _a : kase.status, color: (_b = status === null || status === void 0 ? void 0 : status.color) !== null && _b !== void 0 ? _b : null },
        attention: kase.attention ? ((_c = ATTENTION_OPTIONS.find((o) => o.value === kase.attention)) !== null && _c !== void 0 ? _c : { value: kase.attention, label: kase.attention }) : null,
        customer: kase.user_id ? { id: kase.user_id, label: (_d = people.get(kase.user_id)) !== null && _d !== void 0 ? _d : `#${kase.user_id}`, collection: customersOf().collection } : null,
        assignee: kase.assigned_to_user_id ? { id: kase.assigned_to_user_id, label: (_e = people.get(kase.assigned_to_user_id)) !== null && _e !== void 0 ? _e : `#${kase.assigned_to_user_id}` } : null,
        about: subject && kase[subject.field] ? { id: kase[subject.field], label: (_f = subject.label) !== null && _f !== void 0 ? _f : null, collection: (_g = subject.collection) !== null && _g !== void 0 ? _g : null } : null,
        attachments: (_h = kase.attachments) !== null && _h !== void 0 ? _h : [],
        issues: (_j = kase.issues) !== null && _j !== void 0 ? _j : [],
        awaiting_reply_since: kase.awaiting_reply_since,
        first_response_due_at: kase.first_response_at ? null : kase.first_response_due_at,
        resolution_due_at: kase.resolution_due_at,
        first_response_at: kase.first_response_at,
        created_at: kase.created_at,
    };
}
let ETHCaseAdminController = class ETHCaseAdminController {
    /**
     * GET /admin/cases/:id/thread
     *
     * The case's conversation for the back-office panel: the messages (internal
     * notes too) and the history, merged by date; the canned replies ready to
     * use; and what the staff member may do here.
     */
    thread(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield allowed(req.user, CASES_COLLECTION, 'show'))) {
                return res.error({ status: 403, errors: [`You cannot open ${wordsOf().cases.toLowerCase()}.`] });
            }
            const id = positiveId(req.params.id);
            const { Case, CaseComment } = caseModels();
            const kase = id ? yield Case.findByPk(id) : null;
            if (!kase)
                return res.error({ status: 404, errors: [`This ${wordsOf().case.toLowerCase()} no longer exists.`] });
            const [comments, events, canReply, canUpdate] = yield Promise.all([
                CaseComment.findAll({ where: { case_id: kase.id }, order: [['created_at', 'ASC'], ['id', 'ASC']] }),
                CaseEvent.findAll({ where: { case_id: kase.id }, order: [['created_at', 'ASC'], ['id', 'ASC']] }),
                allowed(req.user, COMMENTS_COLLECTION, 'create'),
                allowed(req.user, CASES_COLLECTION, 'update'),
            ]);
            const assignedIds = events.filter((e) => e.type === CaseEventType.ASSIGNED).flatMap((e) => [e.from_value, e.to_value]);
            const people = yield peopleLabels([kase.user_id, kase.assigned_to_user_id, ...assignedIds]);
            const items = [...comments.map(messageItem), ...events.map((event) => eventItem(event, people))].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
            const readOnly = readOnlyReason(kase);
            return res.success({
                status: 200,
                data: {
                    case: caseSummary(kase, people),
                    items,
                    read_only: readOnly,
                    can_reply: canReply && !readOnly,
                    can_change_status: canUpdate && !readOnly,
                    statuses: statusOptions(),
                    canned_replies: canReply && !readOnly ? yield cannedRepliesFor(kase, req.user) : [],
                    attachments: { internal: attachmentsAllowed(true), public: attachmentsAllowed(false), folder: attachmentFolders()[0] },
                    words: wordsOf(),
                },
            });
        });
    }
    /**
     * POST /admin/cases/:id/replies
     * `{ body, internal?, attachments?: [mediaId], status?, canned_reply_id? }`
     *
     * A staff reply (the customer is told) or an internal note, signed by the
     * staff member; `status` moves the case in the same go. Files are Media
     * rows the staff member uploaded through the back-office first.
     */
    reply(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const input = ((_a = req.body) !== null && _a !== void 0 ? _a : {});
            const status = typeof input.status === 'string' && input.status ? input.status : null;
            if (!(yield allowed(req.user, COMMENTS_COLLECTION, 'create'))) {
                return res.error({ status: 403, errors: [`You cannot answer ${wordsOf().cases.toLowerCase()}.`] });
            }
            if (status && !(yield allowed(req.user, CASES_COLLECTION, 'update'))) {
                return res.error({ status: 403, errors: [`You cannot change the status of ${wordsOf().cases.toLowerCase()}.`] });
            }
            const id = positiveId(req.params.id);
            const { Case } = caseModels();
            const kase = id ? yield Case.findByPk(id) : null;
            if (!kase)
                return res.error({ status: 404, errors: [`This ${wordsOf().case.toLowerCase()} no longer exists.`] });
            const readOnly = readOnlyReason(kase);
            if (readOnly)
                return res.error({ status: 409, errors: [readOnly] });
            const body = typeof input.body === 'string' ? input.body.trim() : '';
            if (!body)
                return res.error({ status: 400, errors: ['Write the message first.'] });
            if (body.length > MAX_BODY)
                return res.error({ status: 400, errors: [`The message is too long (${MAX_BODY} characters at most).`] });
            if (status && !statusOptions().some((o) => o.value === status)) {
                return res.error({ status: 400, errors: ['That status does not exist.'] });
            }
            const internal = input.internal === true || input.internal === 'true';
            const wanted = Array.isArray(input.attachments) ? input.attachments : [];
            if (wanted.length && !attachmentsAllowed(internal)) {
                return res.error({ status: 400, errors: [internal ? 'Files cannot be added here.' : 'Files can only go on internal notes.'] });
            }
            let attachments;
            try {
                attachments = yield attachmentsFromMedia(req.user.id, wanted);
            }
            catch (error) {
                return res.error({ status: 400, errors: [(error === null || error === void 0 ? void 0 : error.message) || 'A file could not be added.'] });
            }
            const comment = yield replyToCase(kase, { body, internal, attachments, author: req.user, status });
            const cannedId = positiveId(input.canned_reply_id);
            if (cannedId)
                yield CaseCannedReply.increment('used_count', { where: { id: cannedId } }).catch(() => undefined);
            yield kase.reload();
            const people = yield peopleLabels([kase.user_id, kase.assigned_to_user_id]);
            return res.success({ status: 201, data: { message: messageItem(comment), case: caseSummary(kase, people) } });
        });
    }
};
__decorate([
    Get('/admin/cases/:id/thread'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHCaseAdminController.prototype, "thread", null);
__decorate([
    Post('/admin/cases/:id/replies'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHCaseAdminController.prototype, "reply", null);
ETHCaseAdminController = __decorate([
    Controller()
], ETHCaseAdminController);
export default ETHCaseAdminController;
