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
 * One question put to the assistant: who asked, what, what it read to answer,
 * and what it cost. The answer itself is not kept — it is made of the
 * project's data, which already lives where it belongs.
 */
let AssistantRequest = class AssistantRequest extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AssistantRequest.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AssistantRequest.prototype, "user_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], AssistantRequest.prototype, "task", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], AssistantRequest.prototype, "question", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], AssistantRequest.prototype, "collection", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], AssistantRequest.prototype, "record_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(512)),
    __metadata("design:type", String)
], AssistantRequest.prototype, "collections_read", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AssistantRequest.prototype, "steps", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], AssistantRequest.prototype, "model", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AssistantRequest.prototype, "input_tokens", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AssistantRequest.prototype, "output_tokens", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AssistantRequest.prototype, "cached_tokens", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AssistantRequest.prototype, "duration_ms", void 0);
__decorate([
    AllowNull(false),
    Default('ok'),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], AssistantRequest.prototype, "status", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], AssistantRequest.prototype, "error", void 0);
AssistantRequest = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'assistant_requests',
        freezeTableName: true,
        indexes: [{ fields: ['user_id', 'created_at'] }, { fields: ['created_at'] }],
    })
], AssistantRequest);
export { AssistantRequest };
