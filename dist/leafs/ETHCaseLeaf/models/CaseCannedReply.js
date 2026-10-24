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
 * A reply staff pick instead of typing it again. `{{customer_name}}`,
 * `{{reference}}`, `{{subject}}` and `{{staff_name}}` are filled in for the
 * case it is used on. Without a kind, it is offered on every case.
 */
let CaseCannedReply = class CaseCannedReply extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], CaseCannedReply.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(120)),
    __metadata("design:type", String)
], CaseCannedReply.prototype, "title", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], CaseCannedReply.prototype, "body", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], CaseCannedReply.prototype, "kind", void 0);
__decorate([
    AllowNull(false),
    Default(true),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], CaseCannedReply.prototype, "active", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], CaseCannedReply.prototype, "used_count", void 0);
CaseCannedReply = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'case_canned_replies',
        freezeTableName: true,
    })
], CaseCannedReply);
export { CaseCannedReply };
