var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default } from '../database/provider.js';
/** Where a record stands with the outside system it is copied to. */
export var SyncStatus;
(function (SyncStatus) {
    /** A change waits to be sent. */
    SyncStatus["PENDING"] = "pending";
    /** A server is sending it now. */
    SyncStatus["SENDING"] = "sending";
    /** The outside system has the last state. */
    SyncStatus["SYNCED"] = "synced";
    /** The last try failed, another is planned (`next_attempt_at`). */
    SyncStatus["FAILED"] = "failed";
    /** Every try failed: only a new change or "Resend" starts again. */
    SyncStatus["BLOCKED"] = "blocked";
})(SyncStatus || (SyncStatus = {}));
/**
 * One record of ours and its copy in an outside system (a Case in Salesforce…):
 * the copy's id, and whether it holds our last state. One row per record and
 * per target, kept after success: the next change reuses its `external_id`.
 */
let ExternalSync = class ExternalSync extends Model {
    /** The link to the copy (`link` of the target), for the back-office. */
    get external_url() {
        return externalUrlOf(this.getDataValue('target'), this.getDataValue('external_id'));
    }
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], ExternalSync.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], ExternalSync.prototype, "target", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], ExternalSync.prototype, "record_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], ExternalSync.prototype, "external_id", void 0);
__decorate([
    AllowNull(false),
    Default(SyncStatus.PENDING),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], ExternalSync.prototype, "status", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], ExternalSync.prototype, "version", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSONB),
    __metadata("design:type", Array)
], ExternalSync.prototype, "changes", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], ExternalSync.prototype, "attempts", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], ExternalSync.prototype, "last_error", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], ExternalSync.prototype, "next_attempt_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], ExternalSync.prototype, "locked_until", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], ExternalSync.prototype, "synced_at", void 0);
__decorate([
    Column(DataType.VIRTUAL),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], ExternalSync.prototype, "external_url", null);
ExternalSync = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'external_syncs',
        freezeTableName: true,
        indexes: [
            { name: 'external_syncs_target_record_unique', unique: true, fields: ['target', 'record_id'] },
            { name: 'external_syncs_due', fields: ['target', 'status', 'next_attempt_at'] },
        ],
    })
], ExternalSync);
export { ExternalSync };
/** One target and whether its sending is on hold. */
let ExternalSyncTarget = class ExternalSyncTarget extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], ExternalSyncTarget.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], ExternalSyncTarget.prototype, "target", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], ExternalSyncTarget.prototype, "label", void 0);
__decorate([
    AllowNull(false),
    Default(false),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], ExternalSyncTarget.prototype, "paused", void 0);
ExternalSyncTarget = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'external_sync_targets',
        freezeTableName: true,
        indexes: [{ name: 'external_sync_targets_target_unique', unique: true, fields: ['target'] }],
    })
], ExternalSyncTarget);
export { ExternalSyncTarget };
/** Set by the registry: models can't import it without a cycle. */
let linker = () => null;
export function setExternalLinker(fn) {
    linker = fn;
}
function externalUrlOf(target, externalId) {
    if (!target || !externalId)
        return null;
    try {
        return linker(target, externalId);
    }
    catch (_a) {
        return null;
    }
}
