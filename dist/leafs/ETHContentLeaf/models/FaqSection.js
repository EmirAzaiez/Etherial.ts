var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, HasMany, BeforeSave } from 'etherial/components/database/provider';
import { cleanTexts, requiredLabel } from '../services/texts.js';
import { FaqQuestion } from './FaqQuestion.js';
/** A heading of the FAQ (General, Payments…) and its questions. The same FAQ for everyone. */
let FaqSection = class FaqSection extends Model {
    static fillLabel(section) {
        section.title = cleanTexts(section.title);
        section.label = requiredLabel(section.title, 'Title');
    }
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], FaqSection.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], FaqSection.prototype, "title", void 0);
__decorate([
    AllowNull(false),
    Default(''),
    Column(DataType.STRING(200)),
    __metadata("design:type", String)
], FaqSection.prototype, "label", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], FaqSection.prototype, "position", void 0);
__decorate([
    AllowNull(false),
    Default(true),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], FaqSection.prototype, "published", void 0);
__decorate([
    HasMany(() => FaqQuestion, { foreignKey: 'section_id', onDelete: 'CASCADE' }),
    __metadata("design:type", Array)
], FaqSection.prototype, "questions", void 0);
__decorate([
    BeforeSave,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [FaqSection]),
    __metadata("design:returntype", void 0)
], FaqSection, "fillLabel", null);
FaqSection = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'content_faq_sections',
        freezeTableName: true,
        indexes: [{ fields: ['published', 'position'] }],
    })
], FaqSection);
export { FaqSection };
