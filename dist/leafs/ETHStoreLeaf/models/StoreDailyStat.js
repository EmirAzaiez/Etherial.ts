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
 * One store, one day, one country — or every country together when `country`
 * is empty. Every figure is the store's own report (null when that store
 * does not give it), except Apple's rating: the public one, read that day.
 * The countries rows hold the downloads only; the rest is on the
 * all-countries row.
 */
let StoreDailyStat = class StoreDailyStat extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StoreDailyStat.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], StoreDailyStat.prototype, "store", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.DATEONLY),
    __metadata("design:type", String)
], StoreDailyStat.prototype, "date", void 0);
__decorate([
    AllowNull(false),
    Default(''),
    Column(DataType.STRING(2)),
    __metadata("design:type", String)
], StoreDailyStat.prototype, "country", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StoreDailyStat.prototype, "downloads", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StoreDailyStat.prototype, "redownloads", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StoreDailyStat.prototype, "updates", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StoreDailyStat.prototype, "uninstalls", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StoreDailyStat.prototype, "active_devices", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DOUBLE),
    __metadata("design:type", Number)
], StoreDailyStat.prototype, "rating_average", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StoreDailyStat.prototype, "ratings_count", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StoreDailyStat.prototype, "impressions", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StoreDailyStat.prototype, "page_views", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StoreDailyStat.prototype, "acquisitions", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StoreDailyStat.prototype, "sessions", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DOUBLE),
    __metadata("design:type", Number)
], StoreDailyStat.prototype, "session_seconds", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StoreDailyStat.prototype, "session_devices", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StoreDailyStat.prototype, "crashes", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StoreDailyStat.prototype, "anrs", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], StoreDailyStat.prototype, "sources", void 0);
StoreDailyStat = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'store_daily_stats',
        freezeTableName: true,
        indexes: [
            { unique: true, fields: ['store', 'date', 'country'] },
            { fields: ['date', 'country'] },
        ],
    })
], StoreDailyStat);
export { StoreDailyStat };
