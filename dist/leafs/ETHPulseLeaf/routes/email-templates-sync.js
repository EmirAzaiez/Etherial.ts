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
import { Controller, Get, Post, Delete } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import etherial from 'etherial';
import { getDefaultContent } from '../seeds/email-template-defaults.js';
const getAdminLeaf = () => etherial.eth_admin_leaf;
const getPulseLeaf = () => etherial.eth_pulse_leaf;
const getEmailTemplateModel = () => {
    return etherial.database.sequelize.models.EmailTemplate;
};
/**
 * Returns the sync status between config-declared templates and DB rows.
 * - missing: keys x locales that exist in config but not in DB
 * - orphans: DB rows whose key is not in config
 */
function computeSync() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const pulseLeaf = getPulseLeaf();
        const templatesConfig = (_b = (_a = pulseLeaf === null || pulseLeaf === void 0 ? void 0 : pulseLeaf.config) === null || _a === void 0 ? void 0 : _a.email) === null || _b === void 0 ? void 0 : _b.templates;
        if (!templatesConfig) {
            return { missing: [], orphans: [], configKeys: [], locales: [] };
        }
        const configKeys = Object.keys(templatesConfig.emails);
        const locales = templatesConfig.locales || ['en'];
        const EmailTemplate = getEmailTemplateModel();
        const allTemplates = yield EmailTemplate.findAll({
            attributes: ['id', 'key', 'locale'],
            raw: true,
        });
        // Build a set of existing key:locale combos
        const existingSet = new Set(allTemplates.map((t) => `${t.key}:${t.locale}`));
        // Missing: in config but not in DB
        const missing = [];
        for (const key of configKeys) {
            for (const locale of locales) {
                if (!existingSet.has(`${key}:${locale}`)) {
                    missing.push({ key, locale, variables: templatesConfig.emails[key] });
                }
            }
        }
        // Orphans: in DB but key not in config
        const configKeySet = new Set(configKeys);
        const orphans = [];
        for (const t of allTemplates) {
            if (!configKeySet.has(t.key)) {
                orphans.push({ id: t.id, key: t.key, locale: t.locale });
            }
        }
        return { missing, orphans, configKeys, locales };
    });
}
let EmailTemplateSyncController = class EmailTemplateSyncController {
    /**
     * GET /admin/email-templates/sync
     * Returns missing and orphan templates
     */
    getSync(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const adminLeaf = getAdminLeaf();
            if (adminLeaf) {
                const hasAccess = yield adminLeaf.canAccessAdmin(req.user);
                if (!hasAccess) {
                    return res.error({ status: 403, errors: ['Forbidden'] });
                }
            }
            const sync = yield computeSync();
            return res.success({
                status: 200,
                data: sync,
            });
        });
    }
    /**
     * POST /admin/email-templates/sync/create
     * Creates a missing template with default content
     * Body: { key: string, locale: string }
     */
    createMissing(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const adminLeaf = getAdminLeaf();
            if (adminLeaf) {
                const hasAccess = yield adminLeaf.canAccessAdmin(req.user);
                if (!hasAccess) {
                    return res.error({ status: 403, errors: ['Forbidden'] });
                }
            }
            const { key, locale } = req.body;
            if (!key || !locale) {
                return res.error({ status: 400, errors: ['key and locale are required'] });
            }
            const EmailTemplate = getEmailTemplateModel();
            // Check if already exists
            const existing = yield EmailTemplate.findOne({ where: { key, locale } });
            if (existing) {
                return res.error({ status: 409, errors: [`Template "${key}" (${locale}) already exists`] });
            }
            const content = getDefaultContent(key, locale);
            const template = yield EmailTemplate.create({
                key,
                locale,
                subject: content.subject,
                title: content.title || null,
                greeting: content.greeting || null,
                body: content.body,
                button_text: content.button_text || null,
                button_url: content.button_url || null,
                footer: content.footer || null,
                enabled: true,
            });
            return res.success({
                status: 201,
                data: template,
                message: `Template "${key}" (${locale}) created`,
            });
        });
    }
    /**
     * DELETE /admin/email-templates/sync/orphan/:id
     * Removes an orphan template (key not in config)
     */
    removeOrphan(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const adminLeaf = getAdminLeaf();
            if (adminLeaf) {
                const hasAccess = yield adminLeaf.canAccessAdmin(req.user);
                if (!hasAccess) {
                    return res.error({ status: 403, errors: ['Forbidden'] });
                }
            }
            const { id } = req.params;
            const EmailTemplate = getEmailTemplateModel();
            const template = yield EmailTemplate.findByPk(id);
            if (!template) {
                return res.error({ status: 404, errors: ['Template not found'] });
            }
            // Verify it's actually an orphan (key not in config)
            const pulseLeaf = getPulseLeaf();
            const configKeys = Object.keys(((_c = (_b = (_a = pulseLeaf === null || pulseLeaf === void 0 ? void 0 : pulseLeaf.config) === null || _a === void 0 ? void 0 : _a.email) === null || _b === void 0 ? void 0 : _b.templates) === null || _c === void 0 ? void 0 : _c.emails) || {});
            if (configKeys.includes(template.key)) {
                return res.error({ status: 400, errors: [`Template "${template.key}" is still declared in config — not an orphan`] });
            }
            yield template.destroy();
            return res.success({
                status: 200,
                message: `Orphan template "${template.key}" (${template.locale}) removed`,
            });
        });
    }
};
__decorate([
    Get('/admin/email-templates/sync'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], EmailTemplateSyncController.prototype, "getSync", null);
__decorate([
    Post('/admin/email-templates/sync/create'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], EmailTemplateSyncController.prototype, "createMissing", null);
__decorate([
    Delete('/admin/email-templates/sync/orphan/:id'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], EmailTemplateSyncController.prototype, "removeOrphan", null);
EmailTemplateSyncController = __decorate([
    Controller()
], EmailTemplateSyncController);
export default EmailTemplateSyncController;
