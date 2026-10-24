var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Default } from 'etherial/components/database/provider';
/**
 * Base Agent (no @Table): an employee who receives customers. Not a user of
 * the app: an agent may have no account, and an account may stop being one.
 *
 * The project adds `appointments`, `holidays` (its blocks, `foreignKey:
 * 'agent_id'`) and, if it links agents to its users, `user_id`.
 */
export class BaseAgent extends Model {
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseAgent.prototype, "id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseAgent.prototype, "first_name", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseAgent.prototype, "last_name", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseAgent.prototype, "email", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING),
    __metadata("design:type", String)
], BaseAgent.prototype, "phone_number", void 0);
__decorate([
    AllowNull(false),
    Default(true),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], BaseAgent.prototype, "active", void 0);
__decorate([
    AllowNull(false),
    Default(1),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], BaseAgent.prototype, "max_concurrent_appointments", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BaseAgent.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date)
], BaseAgent.prototype, "updated_at", void 0);
