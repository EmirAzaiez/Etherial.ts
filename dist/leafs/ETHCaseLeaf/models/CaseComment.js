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
import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Default, Index, AfterCreate } from 'etherial/components/database/provider';
import { afterCommit } from './Case.js';
import { alertStaff, caseTitle, notifyCustomer } from '../services/notices.js';
import { caseModels, readOnlyReason } from '../services/options.js';
import { CaseStatus } from '../services/statuses.js';
/**
 * Base CaseComment (no @Table): a message on a case, from the customer
 * (`resident`) or from staff. A staff message is a reply the customer reads,
 * or an internal note they never see.
 *
 * The project declares the table and adds the foreign keys and associations
 * of `case_id` and `author_user_id`:
 *
 * ```typescript
 * @Table({ timestamps: true, tableName: 'case_comments', freezeTableName: true })
 * export class CaseComment extends BaseCaseComment {
 *     @ForeignKey(() => Case)
 *     declare case_id: number
 *
 *     @BelongsTo(() => Case)
 *     declare case: Case
 * }
 * ```
 */
export class BaseCaseComment extends Model {
    /**
     * A staff reply answers the customer: it starts the "answered" clock and
     * tells them (unless `{ notify: false }`). A customer message puts the
     * case back in the staff's hands and alerts them.
     */
    static commentPosted(comment, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (comment.author_kind === 'staff' && comment.internal)
                return;
            const transaction = options === null || options === void 0 ? void 0 : options.transaction;
            const kase = yield caseModels().Case.findByPk(comment.case_id, { transaction });
            if (!kase)
                return;
            const now = new Date();
            if (comment.author_kind === 'staff') {
                yield kase.update({ first_response_at: (_a = kase.first_response_at) !== null && _a !== void 0 ? _a : now, last_activity_at: now, awaiting_reply_since: null }, { notify: false, transaction });
                if ((options === null || options === void 0 ? void 0 : options.notify) === false)
                    return;
                yield notifyCustomer(kase, 'reply', comment);
                return;
            }
            yield kase.update(Object.assign({ last_activity_at: now, awaiting_reply_since: (_b = kase.awaiting_reply_since) !== null && _b !== void 0 ? _b : now }, (kase.status === CaseStatus.WAITING_ON_CUSTOMER ? { status: CaseStatus.IN_PROGRESS } : {})), { notify: false, transaction });
            if (readOnlyReason(kase))
                return;
            yield afterCommit(options, () => alertStaff('customerReply', kase, { type: 'case_reply', title: caseTitle.reply(kase), body: comment.body, assignee: true }));
        });
    }
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseCaseComment.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseCaseComment.prototype, "case_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseCaseComment.prototype, "author_user_id", void 0);
__decorate([
    AllowNull(false),
    Default('staff'),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseCaseComment.prototype, "author_kind", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseCaseComment.prototype, "author_name", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], BaseCaseComment.prototype, "body", void 0);
__decorate([
    AllowNull(false),
    Default(false),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], BaseCaseComment.prototype, "internal", void 0);
__decorate([
    AllowNull(false),
    Default([]),
    Column(DataType.JSONB),
    __metadata("design:type", Array)
], BaseCaseComment.prototype, "attachments", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BaseCaseComment.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date
    /**
     * A staff reply answers the customer: it starts the "answered" clock and
     * tells them (unless `{ notify: false }`). A customer message puts the
     * case back in the staff's hands and alerts them.
     */
    )
], BaseCaseComment.prototype, "updated_at", void 0);
__decorate([
    AfterCreate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BaseCaseComment, Object]),
    __metadata("design:returntype", Promise)
], BaseCaseComment, "commentPosted", null);
