var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, DataType, Default } from 'etherial/components/database/provider';
/**
 * One visit: from the moment someone opens the app until they leave it for
 * longer than the session timeout (30 minutes by default). Kept up to date as
 * the visit goes on, so the counts and the last screen are read without
 * walking the events.
 */
let AnalyticsSession = class AnalyticsSession extends Model {
};
__decorate([
    PrimaryKey,
    AllowNull(false),
    Column(DataType.STRING(36)),
    __metadata("design:type", String)
], AnalyticsSession.prototype, "id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AnalyticsSession.prototype, "user_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], AnalyticsSession.prototype, "installation_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], AnalyticsSession.prototype, "platform", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(32)),
    __metadata("design:type", String)
], AnalyticsSession.prototype, "app_version", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(32)),
    __metadata("design:type", String)
], AnalyticsSession.prototype, "os_version", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], AnalyticsSession.prototype, "device_model", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], AnalyticsSession.prototype, "locale", void 0);
__decorate([
    AllowNull(false),
    Default('api'),
    Column(DataType.STRING(8)),
    __metadata("design:type", String)
], AnalyticsSession.prototype, "source", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], AnalyticsSession.prototype, "started_at", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], AnalyticsSession.prototype, "last_seen_at", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AnalyticsSession.prototype, "screen_count", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AnalyticsSession.prototype, "event_count", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(128)),
    __metadata("design:type", String)
], AnalyticsSession.prototype, "entry_screen", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(128)),
    __metadata("design:type", String)
], AnalyticsSession.prototype, "exit_screen", void 0);
AnalyticsSession = __decorate([
    Table({
        timestamps: false,
        tableName: 'analytics_sessions',
        freezeTableName: true,
        indexes: [
            { fields: ['started_at'] },
            { fields: ['last_seen_at'] },
            { fields: ['user_id', 'started_at'] },
            { fields: ['installation_id', 'last_seen_at'] },
        ],
    })
], AnalyticsSession);
export { AnalyticsSession };
