var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, BeforeSave, BeforeValidate } from 'etherial/components/database/provider';
import { ContentError, slugify } from '../services/options.js';
import { cleanTexts, orNull, ownText, requiredLabel } from '../services/texts.js';
/**
 * A text the app must show as written: the terms of use, the privacy
 * policy… Its text (HTML), or a page of the project's website to open.
 */
let LegalDocument = class LegalDocument extends Model {
    /** Sequelize checks NOT NULL before `check` runs: an address left empty waits for it as ''. */
    static emptySlug(doc) {
        if (doc.slug == null)
            doc.slug = '';
    }
    static check(doc) {
        var _a;
        doc.title = cleanTexts(doc.title);
        doc.body = cleanTexts(doc.body);
        doc.url = cleanTexts(doc.url);
        doc.label = requiredLabel(doc.title, 'Title');
        doc.slug = slugify(String((_a = doc.slug) !== null && _a !== void 0 ? _a : '').trim() || doc.label);
        if (!doc.slug)
            throw new ContentError('Address: letters, digits and dashes (privacy-policy).');
        doc.version = orNull(doc.version);
        if (doc.published && !ownText(doc.body) && !ownText(doc.url)) {
            throw new ContentError('Write the text, or give the address of a page of your website, before publishing.');
        }
        if (doc.published && !doc.published_at)
            doc.published_at = new Date();
    }
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], LegalDocument.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Default(''),
    Column(DataType.STRING(80)),
    __metadata("design:type", String)
], LegalDocument.prototype, "slug", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], LegalDocument.prototype, "title", void 0);
__decorate([
    AllowNull(false),
    Default(''),
    Column(DataType.STRING(200)),
    __metadata("design:type", String)
], LegalDocument.prototype, "label", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], LegalDocument.prototype, "body", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], LegalDocument.prototype, "url", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(40)),
    __metadata("design:type", String)
], LegalDocument.prototype, "version", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], LegalDocument.prototype, "position", void 0);
__decorate([
    AllowNull(false),
    Default(false),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], LegalDocument.prototype, "published", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], LegalDocument.prototype, "published_at", void 0);
__decorate([
    BeforeValidate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LegalDocument]),
    __metadata("design:returntype", void 0)
], LegalDocument, "emptySlug", null);
__decorate([
    BeforeSave,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LegalDocument]),
    __metadata("design:returntype", void 0)
], LegalDocument, "check", null);
LegalDocument = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'content_legal_documents',
        freezeTableName: true,
        // An index, not a unique column: the alter-sync adds a unique constraint again on every boot.
        indexes: [{ name: 'content_legal_documents_slug_unique', unique: true, fields: ['slug'] }],
    })
], LegalDocument);
export { LegalDocument };
