var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default } from 'etherial/components/database/provider';
/**
 * A survey, written in the back-office: its questions, and when it is asked —
 * after which event of the project, narrowed or not to some of its values (the
 * bookings of a scheduler, the tickets of a type).
 */
let SurveyForm = class SurveyForm extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], SurveyForm.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], SurveyForm.prototype, "key", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], SurveyForm.prototype, "title", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], SurveyForm.prototype, "description", void 0);
__decorate([
    AllowNull(false),
    Default(true),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], SurveyForm.prototype, "active", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], SurveyForm.prototype, "event", void 0);
__decorate([
    AllowNull(false),
    Default([]),
    Column(DataType.JSONB),
    __metadata("design:type", Array)
], SurveyForm.prototype, "targets", void 0);
__decorate([
    AllowNull(false),
    Default([]),
    Column(DataType.JSONB),
    __metadata("design:type", Array)
], SurveyForm.prototype, "questions", void 0);
__decorate([
    AllowNull(false),
    Default(60),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], SurveyForm.prototype, "delay_minutes", void 0);
__decorate([
    AllowNull(false),
    Default(7),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], SurveyForm.prototype, "expires_after_days", void 0);
SurveyForm = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'survey_forms',
        freezeTableName: true,
        // An index, not a unique column: the alter-sync adds a unique constraint again on every boot.
        indexes: [{ unique: true, fields: ['key'] }, { fields: ['event', 'active'] }],
    })
], SurveyForm);
export { SurveyForm };
