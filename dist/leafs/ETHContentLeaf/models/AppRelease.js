var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var AppRelease_1;
import { Op } from 'sequelize';
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, BeforeSave } from 'etherial/components/database/provider';
import { ContentError, PLATFORMS, PLATFORM_NAMES, PROMPTS, parseVersion } from '../services/options.js';
import { cleanTexts } from '../services/texts.js';
/**
 * A version of the app out on a store, and what an older app does: nothing,
 * a banner that asks to update, or a block until it is updated (`prompt`).
 * Published once it is on the store: before, its button would lead to the
 * version before.
 */
let AppRelease = AppRelease_1 = class AppRelease extends Model {
    static check(release) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (!PLATFORMS.includes(release.platform))
                throw new ContentError(`Platform: one of ${PLATFORMS.join(', ')}.`);
            release.version = String((_a = release.version) !== null && _a !== void 0 ? _a : '').trim();
            if (!parseVersion(release.version))
                throw new ContentError('Version: numbers between dots, as on the store (2.0.0).');
            if (!PROMPTS.includes(release.prompt))
                throw new ContentError(`Prompt: one of ${PROMPTS.join(', ')}.`);
            release.title = cleanTexts(release.title);
            release.message = cleanTexts(release.message);
            release.label = `${PLATFORM_NAMES[release.platform]} ${release.version}`;
            const twin = yield AppRelease_1.findOne({
                where: Object.assign({ platform: release.platform, version: release.version }, (release.id ? { id: { [Op.ne]: release.id } } : {})),
                attributes: ['id'],
            });
            if (twin)
                throw new ContentError(`${release.label} is already listed.`);
            if (release.published && !release.published_at)
                release.published_at = new Date();
        });
    }
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AppRelease.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(10)),
    __metadata("design:type", String)
], AppRelease.prototype, "platform", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(20)),
    __metadata("design:type", String)
], AppRelease.prototype, "version", void 0);
__decorate([
    AllowNull(false),
    Default(''),
    Column(DataType.STRING(40)),
    __metadata("design:type", String)
], AppRelease.prototype, "label", void 0);
__decorate([
    AllowNull(false),
    Default('auto'),
    Column(DataType.STRING(10)),
    __metadata("design:type", String)
], AppRelease.prototype, "prompt", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], AppRelease.prototype, "title", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], AppRelease.prototype, "message", void 0);
__decorate([
    AllowNull(false),
    Default(false),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], AppRelease.prototype, "published", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], AppRelease.prototype, "published_at", void 0);
__decorate([
    BeforeSave,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AppRelease]),
    __metadata("design:returntype", Promise)
], AppRelease, "check", null);
AppRelease = AppRelease_1 = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'content_app_releases',
        freezeTableName: true,
        // An index, not unique columns: the alter-sync adds a unique constraint again on every boot.
        indexes: [{ name: 'content_app_releases_platform_version_unique', unique: true, fields: ['platform', 'version'] }],
    })
], AppRelease);
export { AppRelease };
