var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, ForeignKey, BelongsTo, BeforeSave } from 'etherial/components/database/provider';
import { cleanTexts, requiredLabel } from '../services/texts.js';
import { FaqSection } from './FaqSection.js';
/** One question of the FAQ and its answer, written in its section's form. */
let FaqQuestion = class FaqQuestion extends Model {
    static fillLabel(question) {
        question.question = cleanTexts(question.question);
        question.answer = cleanTexts(question.answer);
        question.label = requiredLabel(question.question, 'Question');
        requiredLabel(question.answer, `"${question.label}"'s answer`);
    }
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], FaqQuestion.prototype, "id", void 0);
__decorate([
    ForeignKey(() => FaqSection),
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], FaqQuestion.prototype, "section_id", void 0);
__decorate([
    BelongsTo(() => FaqSection, { foreignKey: 'section_id', onDelete: 'CASCADE' }),
    __metadata("design:type", Function)
], FaqQuestion.prototype, "section", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], FaqQuestion.prototype, "question", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], FaqQuestion.prototype, "answer", void 0);
__decorate([
    AllowNull(false),
    Default(''),
    Column(DataType.STRING(200)),
    __metadata("design:type", String)
], FaqQuestion.prototype, "label", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], FaqQuestion.prototype, "position", void 0);
__decorate([
    AllowNull(false),
    Default(true),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], FaqQuestion.prototype, "published", void 0);
__decorate([
    BeforeSave,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [FaqQuestion]),
    __metadata("design:returntype", void 0)
], FaqQuestion, "fillLabel", null);
FaqQuestion = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'content_faq_questions',
        freezeTableName: true,
        indexes: [{ fields: ['section_id', 'position'] }],
    })
], FaqQuestion);
export { FaqQuestion };
