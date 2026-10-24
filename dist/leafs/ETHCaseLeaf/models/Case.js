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
import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Default, Index, BeforeCreate, AfterCreate, BeforeUpdate, AfterUpdate, AfterDestroy, } from 'etherial/components/database/provider';
import { currentActor } from '../../ETHAdminLeaf/features/audit.js';
import { CaseEvent, CaseEventType } from './CaseEvent.js';
import { logCaseEvent, writtenFrom } from '../services/events.js';
import { alertStaff, caseTitle, notifyCustomer } from '../services/notices.js';
import { readOnlyReason, referenceOf } from '../services/options.js';
import { attentionOf, dueDates } from '../services/sla.js';
import { CaseStatus, FINISHED_STATUSES, OPEN_CASE_STATUSES, isOpenStatus } from '../services/statuses.js';
/** Runs `fn` once the write's transaction commits, or now without one. */
export function afterCommit(options, fn) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if ((_a = options === null || options === void 0 ? void 0 : options.transaction) === null || _a === void 0 ? void 0 : _a.afterCommit)
            options.transaction.afterCommit(() => fn());
        else
            yield fn();
    });
}
/** The changes the history keeps, beside the status's. */
const TRACKED = [
    ['assigned_to_user_id', CaseEventType.ASSIGNED],
    ['priority', CaseEventType.PRIORITY],
    ['category', CaseEventType.CATEGORY],
    ['kind', CaseEventType.KIND],
];
/**
 * Base Case (no @Table): a customer's request — maintenance, a complaint, a
 * question — and how staff handle it.
 *
 * The project declares the table and adds the foreign keys and associations
 * of `user_id` and `assigned_to_user_id`, what a case is about (a unit), and
 * its own columns (a CRM id):
 *
 * ```typescript
 * @Table({ timestamps: true, tableName: 'cases', freezeTableName: true })
 * export class Case extends BaseCase {
 *     @ForeignKey(() => User)
 *     declare user_id: number
 *
 *     @BelongsTo(() => User, 'user_id')
 *     declare user: User
 * }
 * ```
 *
 * The columns, their indexes and the hooks stay here: a subclass declares
 * no `@Column` nor `@Index` on them again.
 *
 * Whoever writes (the app, staff, a sync), the hooks stamp the status's dates,
 * run the clocks (due times, who waits for whom), keep the history and tell
 * the customer when their case is resolved or closed.
 */
export class BaseCase extends Model {
    get is_open() {
        return OPEN_CASE_STATUSES.includes(this.status);
    }
    /** The clocks of a new case; none for one handled elsewhere or already over. */
    static caseStartClocks(kase) {
        return __awaiter(this, void 0, void 0, function* () {
            if (readOnlyReason(kase) || !isOpenStatus(kase.status))
                return;
            const from = kase.created_at ? new Date(kase.created_at) : new Date();
            if (!kase.awaiting_reply_since && !kase.first_response_at && kase.status !== CaseStatus.WAITING_ON_CUSTOMER)
                kase.awaiting_reply_since = from;
            const due = yield dueDates(kase, from);
            if (!kase.first_response_due_at && !kase.first_response_at)
                kase.first_response_due_at = due.first_response_due_at;
            if (!kase.resolution_due_at)
                kase.resolution_due_at = due.resolution_due_at;
            kase.attention = attentionOf(kase);
        });
    }
    static caseOpened(kase, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!kase.reference) {
                const reference = referenceOf(kase.id);
                if (reference)
                    yield kase.update({ reference }, { transaction: options === null || options === void 0 ? void 0 : options.transaction, hooks: false });
            }
            logCaseEvent(kase.id, CaseEventType.CREATED, { to: kase.status }, options);
            // Staff opening one on a customer's behalf know it already.
            if (readOnlyReason(kase) || writtenFrom() === 'back-office')
                return;
            yield afterCommit(options, () => alertStaff('created', kase, { type: 'case_created', title: caseTitle.created(kase), body: kase.subject }));
        });
    }
    /** The status's dates and the clocks, whoever changes the case: the app, staff, a sync. */
    static caseMoveClocks(kase) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const now = new Date();
            const statusChanged = kase.changed('status');
            if (statusChanged) {
                if (!kase.changed('status_entered_at'))
                    kase.status_entered_at = now;
                if (kase.status === CaseStatus.RESOLVED && !kase.changed('resolved_at'))
                    kase.resolved_at = now;
                if (kase.status === CaseStatus.CLOSED && !kase.changed('closed_at'))
                    kase.closed_at = now;
            }
            // Handled elsewhere: no clock, even if it was not when it opened.
            if (readOnlyReason(kase)) {
                for (const field of ['first_response_due_at', 'resolution_due_at', 'awaiting_reply_since', 'attention']) {
                    if (kase[field] !== null && kase[field] !== undefined)
                        kase[field] = null;
                }
                return;
            }
            const wasFinished = FINISHED_STATUSES.includes(kase.previous('status'));
            const finished = FINISHED_STATUSES.includes(kase.status);
            const reopened = statusChanged && wasFinished && !finished;
            if (statusChanged && (finished || kase.status === CaseStatus.WAITING_ON_CUSTOMER) && !kase.changed('awaiting_reply_since')) {
                kase.awaiting_reply_since = null;
            }
            if (reopened) {
                if (!kase.changed('reopened_count'))
                    kase.reopened_count = ((_a = kase.reopened_count) !== null && _a !== void 0 ? _a : 0) + 1;
                // The customer reopening waits for an answer; staff reopening do not make them.
                if (writtenFrom() !== 'back-office' && !kase.changed('awaiting_reply_since'))
                    kase.awaiting_reply_since = now;
                kase.resolution_due_at = (yield dueDates(kase, now)).resolution_due_at;
            }
            else if (!finished && (kase.changed('kind') || kase.changed('category') || kase.changed('priority'))) {
                const due = yield dueDates(kase, new Date((_b = kase.created_at) !== null && _b !== void 0 ? _b : now));
                if (!kase.first_response_at)
                    kase.first_response_due_at = due.first_response_due_at;
                if (!kase.reopened_count)
                    kase.resolution_due_at = due.resolution_due_at;
            }
            const attention = attentionOf(kase, now);
            if (attention !== kase.attention)
                kase.attention = attention;
        });
    }
    static caseChanged(kase, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = options === null || options === void 0 ? void 0 : options.transaction;
            if (kase.changed('status')) {
                const from = kase.previous('status');
                const reopened = FINISHED_STATUSES.includes(from) && !FINISHED_STATUSES.includes(kase.status);
                logCaseEvent(kase.id, reopened ? CaseEventType.REOPENED : CaseEventType.STATUS, { from, to: kase.status }, { transaction });
            }
            for (const [field, type] of TRACKED) {
                if (kase.changed(field))
                    logCaseEvent(kase.id, type, { from: kase.previous(field), to: kase[field] }, { transaction });
            }
            if (kase.changed('confirmation_status') && kase.confirmation_status) {
                const type = kase.confirmation_status === 'REJECTED' ? CaseEventType.REJECTED : CaseEventType.CONFIRMED;
                logCaseEvent(kase.id, type, { to: kase.confirmation_status, note: kase.confirmation_note }, { transaction });
            }
            if (kase.changed('satisfaction_rating') && kase.satisfaction_rating !== null && kase.satisfaction_rating !== undefined) {
                logCaseEvent(kase.id, CaseEventType.RATED, { from: kase.previous('satisfaction_rating'), to: kase.satisfaction_rating, note: kase.satisfaction_note }, { transaction });
            }
            if (!readOnlyReason(kase)) {
                const { actor } = currentActor();
                const assignee = kase.assigned_to_user_id;
                if (kase.changed('assigned_to_user_id') && assignee && !(actor.type === 'user' && actor.id === assignee)) {
                    yield afterCommit(options, () => alertStaff('assigned', kase, { type: 'case_assigned', title: caseTitle.assigned(kase), body: kase.subject, userIds: [assignee] }));
                }
                if (kase.changed('confirmation_status') && kase.confirmation_status === 'REJECTED') {
                    yield afterCommit(options, () => alertStaff('customerReply', kase, { type: 'case_rejected', title: caseTitle.rejected(kase), body: kase.confirmation_note, assignee: true }));
                }
            }
            // The customer, when staff (or the CRM) resolve or close their case; not when they did it themselves.
            if ((options === null || options === void 0 ? void 0 : options.notify) === false || !kase.changed('status') || !kase.user_id)
                return;
            const kind = kase.status === CaseStatus.RESOLVED ? 'resolved' : kase.status === CaseStatus.CLOSED ? 'closed' : null;
            if (kind)
                yield notifyCustomer(kase, kind);
        });
    }
    static caseDestroyed(kase, options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield CaseEvent.destroy({ where: { case_id: kase.id }, transaction: options === null || options === void 0 ? void 0 : options.transaction });
        });
    }
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseCase.prototype, "id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseCase.prototype, "reference", void 0);
__decorate([
    AllowNull(true),
    Index,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseCase.prototype, "user_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseCase.prototype, "assigned_to_user_id", void 0);
__decorate([
    AllowNull(false),
    Default('GENERAL_INQUIRY'),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseCase.prototype, "kind", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseCase.prototype, "subject", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], BaseCase.prototype, "description", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseCase.prototype, "topic", void 0);
__decorate([
    AllowNull(false),
    Default('OTHER'),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseCase.prototype, "category", void 0);
__decorate([
    AllowNull(false),
    Default('MEDIUM'),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseCase.prototype, "priority", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseCase.prototype, "requested_priority", void 0);
__decorate([
    AllowNull(false),
    Default(CaseStatus.NEW),
    Index,
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseCase.prototype, "status", void 0);
__decorate([
    AllowNull(false),
    Default(DataType.NOW),
    Column(DataType.DATE),
    __metadata("design:type", Date
    /** APP, BACKOFFICE, SURVEY, or the CRM's origin. */
    )
], BaseCase.prototype, "status_entered_at", void 0);
__decorate([
    AllowNull(false),
    Default('APP'),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseCase.prototype, "channel", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseCase.prototype, "location", void 0);
__decorate([
    AllowNull(false),
    Default([]),
    Column(DataType.JSONB),
    __metadata("design:type", Array)
], BaseCase.prototype, "issues", void 0);
__decorate([
    AllowNull(false),
    Default([]),
    Column(DataType.JSONB),
    __metadata("design:type", Array)
], BaseCase.prototype, "attachments", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], BaseCase.prototype, "resolution_note", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BaseCase.prototype, "first_response_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BaseCase.prototype, "resolved_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BaseCase.prototype, "closed_at", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseCase.prototype, "reopened_count", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseCase.prototype, "satisfaction_rating", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], BaseCase.prototype, "satisfaction_note", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseCase.prototype, "confirmation_status", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], BaseCase.prototype, "confirmation_note", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BaseCase.prototype, "confirmation_at", void 0);
__decorate([
    AllowNull(false),
    Default(DataType.NOW),
    Index,
    Column(DataType.DATE),
    __metadata("design:type", Date
    /** When the first staff answer is due (the SLA policy when it opened). */
    )
], BaseCase.prototype, "last_activity_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BaseCase.prototype, "first_response_due_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BaseCase.prototype, "resolution_due_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], BaseCase.prototype, "awaiting_reply_since", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], BaseCase.prototype, "attention", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BaseCase.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date)
], BaseCase.prototype, "updated_at", void 0);
__decorate([
    BeforeCreate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BaseCase]),
    __metadata("design:returntype", Promise)
], BaseCase, "caseStartClocks", null);
__decorate([
    AfterCreate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BaseCase, Object]),
    __metadata("design:returntype", Promise)
], BaseCase, "caseOpened", null);
__decorate([
    BeforeUpdate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BaseCase]),
    __metadata("design:returntype", Promise)
], BaseCase, "caseMoveClocks", null);
__decorate([
    AfterUpdate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BaseCase, Object]),
    __metadata("design:returntype", Promise)
], BaseCase, "caseChanged", null);
__decorate([
    AfterDestroy,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BaseCase, Object]),
    __metadata("design:returntype", Promise)
], BaseCase, "caseDestroyed", null);
export { CaseStatus, OPEN_CASE_STATUSES, DONE_STATUSES, FINISHED_STATUSES, CaseAttention, awaitsConfirmation } from '../services/statuses.js';
