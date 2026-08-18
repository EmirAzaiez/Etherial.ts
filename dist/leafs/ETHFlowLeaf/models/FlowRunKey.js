var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, Index, } from 'etherial/components/database/provider';
/**
 * "This flow has already dealt with this."
 *
 * A flow that watches for appointments starting within 24 hours is asked the
 * same question every ten minutes, and for six hours running the same
 * appointment answers yes. Something has to remember that the reminder went
 * out, and it cannot be a variable in the process: two workers, or one worker
 * restarted, would both send it.
 *
 * So the memory is a row, and the guarantee is the unique index. The engine
 * inserts `(flow_id, key)` before it does anything else; a duplicate key error
 * *is* the answer "already done", and no run is created. `expires_at` decides
 * when the same key becomes fireable again — which is how "once", "once a day"
 * and "once every N hours" are all the same mechanism.
 */
let FlowRunKey = class FlowRunKey extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], FlowRunKey.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], FlowRunKey.prototype, "flow_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(191)),
    __metadata("design:type", String)
], FlowRunKey.prototype, "key", void 0);
__decorate([
    AllowNull(true),
    Index,
    Column,
    __metadata("design:type", Date)
], FlowRunKey.prototype, "expires_at", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Number)
], FlowRunKey.prototype, "run_id", void 0);
__decorate([
    AllowNull(false),
    Default(DataType.NOW),
    Column,
    __metadata("design:type", Date)
], FlowRunKey.prototype, "created_at", void 0);
FlowRunKey = __decorate([
    Table({
        timestamps: false,
        tableName: 'flow_run_keys',
        freezeTableName: true,
        indexes: [
            {
                name: 'flow_run_keys_flow_key',
                unique: true,
                fields: ['flow_id', 'key'],
            },
        ],
    })
], FlowRunKey);
export { FlowRunKey };
