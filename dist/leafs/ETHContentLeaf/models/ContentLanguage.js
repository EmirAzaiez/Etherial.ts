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
var ContentLanguage_1;
import { Op } from 'sequelize';
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, BeforeValidate, BeforeSave, AfterSave, BeforeDestroy, AfterDestroy } from 'etherial/components/database/provider';
import { missingIn, relabel } from '../services/coverage.js';
import { ContentError, isLocale, languageName, nativeName, rtlOf } from '../services/options.js';
import { state } from '../services/state.js';
/** `a, b and c`. */
const listOf = (parts) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]);
/** After the save's transaction, if any: read before, the languages would miss it. */
function afterCommit(transaction, run) {
    if (transaction)
        transaction.afterCommit(() => run().catch((err) => console.error('[ETHContentLeaf] The languages could not be read again:', err)));
    else
        return run();
}
/**
 * A language the contents are written in (Content › Languages): its fields
 * in every form of the back-office, and in the app once `published`. One is
 * the default: what a text missing in another language falls back to, so
 * every content needs it. A language removed leaves its texts in place.
 */
let ContentLanguage = ContentLanguage_1 = class ContentLanguage extends Model {
    /** The languages to the running leaf, the default first. */
    static load() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const rows = yield ContentLanguage_1.findAll({ order: [['id', 'ASC']] });
            const fallback = (_a = rows.find((r) => r.is_default)) !== null && _a !== void 0 ? _a : rows[0];
            if (!fallback)
                state.languages = null;
            else {
                const ordered = [fallback, ...rows.filter((r) => r !== fallback)];
                state.languages = {
                    all: ordered.map((r) => r.code),
                    app: ordered.filter((r) => r === fallback || r.published).map((r) => r.code),
                    default: fallback.code,
                    rtl: ordered.filter((r) => r.rtl).map((r) => r.code),
                    names: Object.fromEntries(ordered.map((r) => [r.code, r.name || nativeName(r.code)])),
                };
            }
            for (const listener of state.onLanguages)
                listener();
        });
    }
    /** Sequelize checks NOT NULL before `check` runs: a name left empty waits for it as ''. */
    static emptyName(language) {
        if (language.name == null)
            language.name = '';
    }
    static check(language, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const transaction = (_a = options.transaction) !== null && _a !== void 0 ? _a : undefined;
            language.code = String((_b = language.code) !== null && _b !== void 0 ? _b : '')
                .trim()
                .toLowerCase();
            if (!isLocale(language.code))
                throw new ContentError('Language: its code, two or three letters (fr, es).');
            if (!language.isNewRecord && language.changed('code')) {
                throw new ContentError("A language's code can't change: add the other language, then remove this one.");
            }
            const name = languageName(language.code);
            language.name = String((_c = language.name) !== null && _c !== void 0 ? _c : '').trim() || nativeName(language.code);
            if (language.rtl === null || language.rtl === undefined)
                language.rtl = rtlOf(state.config, language.code);
            const others = Object.assign({}, (language.id ? { id: { [Op.ne]: language.id } } : {}));
            if (yield ContentLanguage_1.findOne({ where: Object.assign(Object.assign({}, others), { code: language.code }), attributes: ['id'], transaction })) {
                throw new ContentError(`${name} is already listed.`);
            }
            const current = yield ContentLanguage_1.findOne({ where: Object.assign(Object.assign({}, others), { is_default: true }), attributes: ['id'], transaction });
            const wasDefault = !language.isNewRecord && !!language.previous('is_default');
            if (!language.is_default && !current) {
                if (wasDefault)
                    throw new ContentError(`${name} is the default language: make another one the default instead.`);
                // The first language is the default.
                language.is_default = true;
            }
            if (language.is_default && current) {
                // Every content needs its text in the default language: refused while one has none.
                const missing = yield missingIn(language.code);
                if (missing.length) {
                    throw new ContentError(`${name} can't be the default language yet: ${listOf(missing.map((m) => `${m.count} ${m.what}`))} have no ${name} text. Write them first, then try again.`);
                }
                language.becomesDefault = true;
            }
            if (language.is_default && !language.published) {
                if (wasDefault && language.changed('published'))
                    throw new ContentError(`${name} is the default language: the app always gets it.`);
                language.published = true;
            }
        });
    }
    /** The previous default no longer is; the back-office's titles follow the new one. Then the languages are read again. */
    static switched(language, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (language.becomesDefault) {
                language.becomesDefault = false;
                yield ContentLanguage_1.update({ is_default: false }, { where: { id: { [Op.ne]: language.id }, is_default: true }, hooks: false, transaction: (_a = options.transaction) !== null && _a !== void 0 ? _a : undefined });
                yield relabel(language.code, (_b = options.transaction) !== null && _b !== void 0 ? _b : undefined);
            }
            yield afterCommit(options.transaction, () => ContentLanguage_1.load());
        });
    }
    static keepDefault(language) {
        if (language.is_default)
            throw new ContentError(`${languageName(language.code)} is the default language: make another one the default first.`);
    }
    static removed(_language, options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield afterCommit(options.transaction, () => ContentLanguage_1.load());
        });
    }
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], ContentLanguage.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(10)),
    __metadata("design:type", String)
], ContentLanguage.prototype, "code", void 0);
__decorate([
    AllowNull(false),
    Default(''),
    Column(DataType.STRING(40)),
    __metadata("design:type", String)
], ContentLanguage.prototype, "name", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], ContentLanguage.prototype, "rtl", void 0);
__decorate([
    AllowNull(false),
    Default(false),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], ContentLanguage.prototype, "is_default", void 0);
__decorate([
    AllowNull(false),
    Default(false),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], ContentLanguage.prototype, "published", void 0);
__decorate([
    BeforeValidate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ContentLanguage]),
    __metadata("design:returntype", void 0)
], ContentLanguage, "emptyName", null);
__decorate([
    BeforeSave,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ContentLanguage, Object]),
    __metadata("design:returntype", Promise)
], ContentLanguage, "check", null);
__decorate([
    AfterSave,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ContentLanguage, Object]),
    __metadata("design:returntype", Promise)
], ContentLanguage, "switched", null);
__decorate([
    BeforeDestroy,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ContentLanguage]),
    __metadata("design:returntype", void 0)
], ContentLanguage, "keepDefault", null);
__decorate([
    AfterDestroy,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ContentLanguage, Object]),
    __metadata("design:returntype", Promise)
], ContentLanguage, "removed", null);
ContentLanguage = ContentLanguage_1 = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'content_languages',
        freezeTableName: true,
        // An index, not a unique column: the alter-sync adds a unique constraint again on every boot.
        indexes: [{ name: 'content_languages_code_unique', unique: true, fields: ['code'] }],
    })
], ContentLanguage);
export { ContentLanguage };
