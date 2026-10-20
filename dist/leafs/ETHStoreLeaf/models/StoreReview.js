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
 * A written review, as the store's own report gives it: App Store Connect's
 * customer reviews, Google Play's monthly reviews file. Read again while it
 * is recent: the author may edit it, the developer reply to it.
 */
let StoreReview = class StoreReview extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StoreReview.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], StoreReview.prototype, "store", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], StoreReview.prototype, "review_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StoreReview.prototype, "rating", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], StoreReview.prototype, "title", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], StoreReview.prototype, "body", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], StoreReview.prototype, "author", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(8)),
    __metadata("design:type", String)
], StoreReview.prototype, "territory", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(16)),
    __metadata("design:type", String)
], StoreReview.prototype, "language", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(64)),
    __metadata("design:type", String)
], StoreReview.prototype, "version", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(128)),
    __metadata("design:type", String)
], StoreReview.prototype, "device", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.DATE),
    __metadata("design:type", Date
    /** The developer's answer, as published (Apple also gives one still waiting to be). */
    )
], StoreReview.prototype, "written_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], StoreReview.prototype, "reply", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], StoreReview.prototype, "replied_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(1024)),
    __metadata("design:type", String)
], StoreReview.prototype, "url", void 0);
StoreReview = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'store_reviews',
        freezeTableName: true,
        indexes: [
            { unique: true, fields: ['store', 'review_id'] },
            { fields: ['written_at'] },
        ],
    })
], StoreReview);
export { StoreReview };
