var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType } from 'etherial/components/database/provider';
/**
 * One person's conversation with the assistant, kept to be reopened from the
 * panel and carried on. Only with the leaf's `history` on: unlike the log, it
 * holds the answers, which are made of the project's data.
 *
 * The turns are kept as the panel shows them — the question, the page it was
 * asked from, the answer, its look-ups, the changes it proposed and what the
 * person decided — in one JSON column: they are only ever read back whole,
 * by their owner.
 */
let AssistantConversation = class AssistantConversation extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AssistantConversation.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AssistantConversation.prototype, "user_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(200)),
    __metadata("design:type", String)
], AssistantConversation.prototype, "title", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.JSON),
    __metadata("design:type", Array)
], AssistantConversation.prototype, "turns", void 0);
AssistantConversation = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'assistant_conversations',
        freezeTableName: true,
        indexes: [{ fields: ['user_id', 'updated_at'] }, { fields: ['updated_at'] }],
    })
], AssistantConversation);
export { AssistantConversation };
