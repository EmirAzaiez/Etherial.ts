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
/** What happened to a case, besides its messages. */
export var CaseEventType;
(function (CaseEventType) {
    CaseEventType["CREATED"] = "created";
    CaseEventType["STATUS"] = "status";
    CaseEventType["ASSIGNED"] = "assigned";
    CaseEventType["PRIORITY"] = "priority";
    CaseEventType["CATEGORY"] = "category";
    CaseEventType["KIND"] = "kind";
    CaseEventType["REOPENED"] = "reopened";
    CaseEventType["CONFIRMED"] = "confirmed";
    CaseEventType["REJECTED"] = "rejected";
    CaseEventType["RATED"] = "rated";
    CaseEventType["OVERDUE"] = "overdue";
})(CaseEventType || (CaseEventType = {}));
/**
 * A case's history, shown between its messages in the back-office: who
 * changed the status, the assignee, the priority, and when the customer
 * confirmed, rejected or rated a resolution. Written by the case's hooks,
 * whoever writes (the app, staff, a sync).
 */
let CaseEvent = class CaseEvent extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], CaseEvent.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], CaseEvent.prototype, "case_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(32)),
    __metadata("design:type", String)
], CaseEvent.prototype, "type", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], CaseEvent.prototype, "from_value", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], CaseEvent.prototype, "to_value", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(32)),
    __metadata("design:type", String)
], CaseEvent.prototype, "actor_type", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], CaseEvent.prototype, "actor_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], CaseEvent.prototype, "actor_label", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(32)),
    __metadata("design:type", String)
], CaseEvent.prototype, "source", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], CaseEvent.prototype, "note", void 0);
CaseEvent = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        tableName: 'case_events',
        freezeTableName: true,
        indexes: [{ name: 'case_events_case_id', fields: ['case_id', 'created_at'] }],
    })
], CaseEvent);
export { CaseEvent };
