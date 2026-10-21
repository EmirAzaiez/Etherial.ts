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
 * One question put to one person: asked, then answered, dismissed or left to
 * expire. The row exists from the moment the person is invited, so the
 * back-office can tell how many of those asked answered.
 */
let SurveyResponse = class SurveyResponse extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], SurveyResponse.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], SurveyResponse.prototype, "survey", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], SurveyResponse.prototype, "user_id", void 0);
__decorate([
    AllowNull(false),
    Default(''),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], SurveyResponse.prototype, "subject_type", void 0);
__decorate([
    AllowNull(false),
    Default(''),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], SurveyResponse.prototype, "subject_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], SurveyResponse.prototype, "subject_label", void 0);
__decorate([
    AllowNull(false),
    Default('pending'),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], SurveyResponse.prototype, "status", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], SurveyResponse.prototype, "score", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], SurveyResponse.prototype, "comment", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], SurveyResponse.prototype, "answers", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], SurveyResponse.prototype, "locale", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], SurveyResponse.prototype, "platform", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(32)),
    __metadata("design:type", String)
], SurveyResponse.prototype, "app_version", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], SurveyResponse.prototype, "available_at", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], SurveyResponse.prototype, "expires_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], SurveyResponse.prototype, "notified_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], SurveyResponse.prototype, "answered_at", void 0);
SurveyResponse = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'survey_responses',
        freezeTableName: true,
        indexes: [
            { fields: ['survey', 'answered_at'] },
            { fields: ['user_id', 'status'] },
            { fields: ['user_id', 'created_at'] },
            { fields: ['status', 'available_at'] },
            // One question per person and per thing that happened.
            { unique: true, fields: ['survey', 'user_id', 'subject_type', 'subject_id'] },
        ],
    })
], SurveyResponse);
export { SurveyResponse };
