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
 * A page written in the back-office: a title and blocks in each language.
 * The app draws the blocks itself; the same page is also published as HTML in
 * the bucket, for a shared link and for the app's web view.
 */
let Page = class Page extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], Page.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(80)),
    __metadata("design:type", String)
], Page.prototype, "slug", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], Page.prototype, "title", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], Page.prototype, "summary", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], Page.prototype, "blocks", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], Page.prototype, "head", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], Page.prototype, "cover", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], Page.prototype, "logo", void 0);
__decorate([
    AllowNull(false),
    Default(false),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], Page.prototype, "published", void 0);
__decorate([
    AllowNull(false),
    Default(true),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], Page.prototype, "in_menu", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(80)),
    __metadata("design:type", String)
], Page.prototype, "owner", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], Page.prototype, "position", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], Page.prototype, "html", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(80)),
    __metadata("design:type", String)
], Page.prototype, "published_slug", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], Page.prototype, "published_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(48)),
    __metadata("design:type", String)
], Page.prototype, "preview_key", void 0);
Page = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'content_pages',
        freezeTableName: true,
        // An index, not a unique column: the alter-sync adds a unique constraint again on every boot.
        indexes: [{ unique: true, fields: ['slug'] }, { fields: ['published', 'position'] }],
    })
], Page);
export { Page };
