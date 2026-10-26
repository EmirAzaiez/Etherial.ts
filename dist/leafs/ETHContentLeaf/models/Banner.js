var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, BeforeSave } from 'etherial/components/database/provider';
import { AUDIENCES, ContentError, labelOf } from '../services/options.js';
import { languages } from '../services/state.js';
import { cleanTexts, orNull } from '../services/texts.js';
/**
 * A slide of the home screen's carousel: an image, words on it if need be,
 * and where a tap goes. `image` is the project's media row (an association
 * the leaf adds at boot).
 */
let Banner = class Banner extends Model {
    static check(banner) {
        banner.title = cleanTexts(banner.title);
        banner.subtitle = cleanTexts(banner.subtitle);
        banner.button = cleanTexts(banner.button);
        banner.label = labelOf(banner.title, languages().default);
        banner.link = orNull(banner.link);
        if (!AUDIENCES.includes(banner.audience))
            throw new ContentError(`Audience: one of ${AUDIENCES.join(', ')}.`);
        if (banner.starts_at && banner.ends_at && new Date(banner.ends_at) <= new Date(banner.starts_at)) {
            throw new ContentError('The end must come after the start.');
        }
    }
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], Banner.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], Banner.prototype, "image_id", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], Banner.prototype, "title", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], Banner.prototype, "subtitle", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], Banner.prototype, "button", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(500)),
    __metadata("design:type", String)
], Banner.prototype, "link", void 0);
__decorate([
    AllowNull(false),
    Default(''),
    Column(DataType.STRING(200)),
    __metadata("design:type", String)
], Banner.prototype, "label", void 0);
__decorate([
    AllowNull(false),
    Default('everyone'),
    Column(DataType.STRING(20)),
    __metadata("design:type", String)
], Banner.prototype, "audience", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], Banner.prototype, "starts_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], Banner.prototype, "ends_at", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], Banner.prototype, "position", void 0);
__decorate([
    AllowNull(false),
    Default(false),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], Banner.prototype, "published", void 0);
__decorate([
    BeforeSave,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Banner]),
    __metadata("design:returntype", void 0)
], Banner, "check", null);
Banner = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'content_banners',
        freezeTableName: true,
        indexes: [{ fields: ['published', 'position'] }],
    })
], Banner);
export { Banner };
