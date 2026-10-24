var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, AfterSave, AfterDestroy } from 'etherial/components/database/provider';
import { forgetSlaPolicies } from '../services/sla.js';
/**
 * How fast a case must be answered and resolved, in hours from its opening
 * (calendar hours, nights and weekends included). The most specific active
 * policy wins: one naming kind, category and priority beats one naming only
 * the priority; a policy naming none of them is the default.
 */
let CaseSlaPolicy = class CaseSlaPolicy extends Model {
    /** The cases opened next use the change at once, on this server. */
    static forget() {
        forgetSlaPolicies();
    }
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], CaseSlaPolicy.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(120)),
    __metadata("design:type", String)
], CaseSlaPolicy.prototype, "label", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], CaseSlaPolicy.prototype, "kind", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], CaseSlaPolicy.prototype, "category", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], CaseSlaPolicy.prototype, "priority", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.FLOAT),
    __metadata("design:type", Number)
], CaseSlaPolicy.prototype, "first_response_hours", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.FLOAT),
    __metadata("design:type", Number)
], CaseSlaPolicy.prototype, "resolution_hours", void 0);
__decorate([
    AllowNull(false),
    Default(true),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], CaseSlaPolicy.prototype, "active", void 0);
__decorate([
    AfterSave,
    AfterDestroy,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CaseSlaPolicy, "forget", null);
CaseSlaPolicy = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'case_sla_policies',
        freezeTableName: true,
    })
], CaseSlaPolicy);
export { CaseSlaPolicy };
