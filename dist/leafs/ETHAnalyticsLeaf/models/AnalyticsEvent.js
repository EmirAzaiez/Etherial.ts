var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, } from 'etherial/components/database/provider';
/**
 * One thing a user did: a screen they opened, a button they pressed, a call
 * their app made to the API, the app coming to the foreground.
 *
 * `name` is stored raw — the route name, the event key, `GET /users/me/tickets`
 * — and turned into words when it is shown, so a label can change without
 * rewriting history. `user_id` is a plain integer: the leaf does not know the
 * project's user model, and a guest has none.
 */
let AnalyticsEvent = class AnalyticsEvent extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column(DataType.BIGINT),
    __metadata("design:type", Number)
], AnalyticsEvent.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(36)),
    __metadata("design:type", String)
], AnalyticsEvent.prototype, "session_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AnalyticsEvent.prototype, "user_id", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], AnalyticsEvent.prototype, "installation_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], AnalyticsEvent.prototype, "type", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(160)),
    __metadata("design:type", String)
], AnalyticsEvent.prototype, "name", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(128)),
    __metadata("design:type", String)
], AnalyticsEvent.prototype, "screen", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], AnalyticsEvent.prototype, "properties", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AnalyticsEvent.prototype, "duration_ms", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AnalyticsEvent.prototype, "status", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], AnalyticsEvent.prototype, "platform", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(32)),
    __metadata("design:type", String)
], AnalyticsEvent.prototype, "app_version", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], AnalyticsEvent.prototype, "created_at", void 0);
AnalyticsEvent = __decorate([
    Table({
        timestamps: false,
        tableName: 'analytics_events',
        freezeTableName: true,
        indexes: [
            { fields: ['created_at'] },
            { fields: ['type', 'name', 'created_at'] },
            { fields: ['user_id', 'created_at'] },
            { fields: ['session_id', 'created_at'] },
        ],
    })
], AnalyticsEvent);
export { AnalyticsEvent };
