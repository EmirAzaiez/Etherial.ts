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
import { Column, Model, AllowNull, Default, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Index, } from 'etherial/components/database/provider';
/**
 * Base EmailTemplate Model (no @Table - define it in your project)
 *
 * Stores configurable email templates with multi-language support.
 * Each row = one template + one locale. Unique constraint on (key, locale).
 *
 * Text fields support {{variable}} placeholders that are replaced at send time.
 *
 * Usage in your project:
 * ```typescript
 * import { BaseEmailTemplate } from './ETHPulseLeaf/models/EmailTemplate.js'
 *
 * @Table({ tableName: 'email_templates', indexes: [{ unique: true, fields: ['key', 'locale'] }] })
 * export class EmailTemplate extends BaseEmailTemplate {}
 * ```
 */
export class BaseEmailTemplate extends Model {
    /**
     * Replace {{variable}} placeholders in a string
     */
    static replacePlaceholders(text, variables) {
        if (!text) {
            return undefined;
        }
        return text.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
            return variables[key] !== undefined ? variables[key] : `{{${key}}}`;
        });
    }
    /**
     * Resolve all template fields with the given variables
     */
    resolve(variables = {}) {
        const r = BaseEmailTemplate.replacePlaceholders;
        return {
            subject: r(this.subject, variables),
            title: r(this.title, variables),
            greeting: r(this.greeting, variables),
            body: r(this.body, variables),
            buttonText: r(this.button_text, variables),
            buttonUrl: r(this.button_url, variables),
            additionalContent: r(this.additional_content, variables),
            footer: r(this.footer, variables),
        };
    }
    /**
     * Find a template by key and locale, with fallback to default locale
     */
    static findByKey(key_1) {
        return __awaiter(this, arguments, void 0, function* (key, locale = 'en', fallbackLocale = 'en') {
            var _a, _b;
            const sequelize = (_a = (yield import('etherial')).default.database) === null || _a === void 0 ? void 0 : _a.sequelize;
            const EmailTemplateModel = (_b = sequelize === null || sequelize === void 0 ? void 0 : sequelize.models) === null || _b === void 0 ? void 0 : _b.EmailTemplate;
            if (!EmailTemplateModel) {
                throw new Error('[EmailTemplate] EmailTemplate model not registered in Sequelize');
            }
            let template = yield EmailTemplateModel.findOne({
                where: { key, locale, enabled: true }
            });
            if (!template && locale !== fallbackLocale) {
                template = yield EmailTemplateModel.findOne({
                    where: { key, locale: fallbackLocale, enabled: true }
                });
            }
            return template;
        });
    }
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], BaseEmailTemplate.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column(DataType.STRING(100)),
    __metadata("design:type", String)
], BaseEmailTemplate.prototype, "key", void 0);
__decorate([
    Default('en'),
    AllowNull(false),
    Index,
    Column(DataType.STRING(10)),
    __metadata("design:type", String)
], BaseEmailTemplate.prototype, "locale", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING(500)),
    __metadata("design:type", String)
], BaseEmailTemplate.prototype, "subject", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseEmailTemplate.prototype, "title", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(500)),
    __metadata("design:type", String)
], BaseEmailTemplate.prototype, "greeting", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], BaseEmailTemplate.prototype, "body", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(255)),
    __metadata("design:type", String)
], BaseEmailTemplate.prototype, "button_text", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(500)),
    __metadata("design:type", String)
], BaseEmailTemplate.prototype, "button_url", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], BaseEmailTemplate.prototype, "additional_content", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(500)),
    __metadata("design:type", String)
], BaseEmailTemplate.prototype, "footer", void 0);
__decorate([
    Default(true),
    AllowNull(false),
    Column,
    __metadata("design:type", Boolean)
], BaseEmailTemplate.prototype, "enabled", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BaseEmailTemplate.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date
    /**
     * Replace {{variable}} placeholders in a string
     */
    )
], BaseEmailTemplate.prototype, "updated_at", void 0);
// Alias for convenience
export { BaseEmailTemplate as EmailTemplate };
