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
import { Op } from 'sequelize';
import { Controller, Get } from 'etherial/components/http/provider';
import { Banner } from '../models/Banner.js';
import { Contact } from '../models/Contact.js';
import { FaqQuestion } from '../models/FaqQuestion.js';
import { FaqSection } from '../models/FaqSection.js';
import { LegalDocument } from '../models/LegalDocument.js';
import { Office } from '../models/Office.js';
import { Story } from '../models/Story.js';
import { StorySlide } from '../models/StorySlide.js';
import { isSignedIn, localeOf } from '../services/http.js';
import { languages as languagesNow } from '../services/state.js';
import { mediaInclude } from '../services/media.js';
import { serializeBanner, serializeContact, serializeFaqSection, serializeLegal, serializeOffice, serializeStory } from '../services/serialize.js';
import { appUpdateOf, platformOf } from '../services/versions.js';
const ORDER = [
    ['position', 'ASC'],
    ['id', 'ASC'],
];
/** Published, for whoever asks, between its dates. */
function liveWhere(req) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = new Date();
        return {
            published: true,
            audience: { [Op.in]: (yield isSignedIn(req)) ? ['everyone', 'signed_in'] : ['everyone', 'guests'] },
            [Op.and]: [{ [Op.or]: [{ starts_at: null }, { starts_at: { [Op.lte]: now } }] }, { [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gt]: now } }] }],
        };
    });
}
/**
 * No sign-in: these are what the company tells everyone, guests included.
 * Only banners and stories look at who asks (their audience). A draft is
 * never served. Each answer says the language it is written in.
 */
let ETHContentAppController = class ETHContentAppController {
    /** GET /content/languages — those the app gets, the default first: for a language picker. */
    languages(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const locale = localeOf(req);
            const { app, default: fallback, names, rtl } = languagesNow();
            const list = app.map((code) => { var _a; return ({ code, name: (_a = names[code]) !== null && _a !== void 0 ? _a : code, rtl: rtl.includes(code), default: code === fallback }); });
            return res.success({ status: 200, data: { locale, default: fallback, languages: list } });
        });
    }
    /** GET /content/faq — the sections and their questions, in order. A section without a question isn't sent. */
    faq(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const locale = localeOf(req);
            const sections = yield FaqSection.findAll({
                where: { published: true },
                include: [{ model: FaqQuestion, as: 'questions', where: { published: true }, required: true }],
                order: [...ORDER, [{ model: FaqQuestion, as: 'questions' }, 'position', 'ASC'], [{ model: FaqQuestion, as: 'questions' }, 'id', 'ASC']],
            });
            return res.success({ status: 200, data: { locale, sections: sections.map((s) => serializeFaqSection(s, locale)) } });
        });
    }
    /** GET /content/contacts — the ways to reach the company, and its offices. */
    contacts(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const locale = localeOf(req);
            const [channels, offices] = yield Promise.all([
                Contact.findAll({ where: { published: true }, order: ORDER }),
                Office.findAll({ where: { published: true }, order: ORDER }),
            ]);
            return res.success({
                status: 200,
                data: { locale, channels: channels.map((c) => serializeContact(c, locale)), offices: offices.map((o) => serializeOffice(o, locale)) },
            });
        });
    }
    /** GET /content/legal — the published documents, without their text. */
    legal(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const locale = localeOf(req);
            const docs = yield LegalDocument.findAll({ where: { published: true }, order: ORDER });
            return res.success({ status: 200, data: { locale, documents: docs.map((d) => serializeLegal(d, locale)) } });
        });
    }
    /** GET /content/legal/:slug — one document, with its text (HTML). */
    legalDocument(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const slug = String((_a = req.params.slug) !== null && _a !== void 0 ? _a : '').toLowerCase();
            const doc = /^[a-z0-9-]{1,80}$/.test(slug) ? yield LegalDocument.findOne({ where: { slug, published: true } }) : null;
            if (!doc)
                return res.error({ status: 404, errors: ['legal_document_not_found'] });
            const locale = localeOf(req);
            return res.success({ status: 200, data: Object.assign({ locale }, serializeLegal(doc, locale, true)) });
        });
    }
    /** GET /content/banners — the home screen's carousel, for whoever asks. A banner whose image is gone isn't sent. */
    banners(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const locale = localeOf(req);
            const banners = yield Banner.findAll({ where: yield liveWhere(req), include: mediaInclude(Banner, 'image'), order: ORDER });
            const data = banners.map((b) => serializeBanner(b, locale)).filter((b) => b.image);
            return res.success({ status: 200, data: { locale, banners: data } });
        });
    }
    /** GET /content/stories — the bubbles and their slides, for whoever asks. A story without a slide to show isn't sent. */
    stories(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const locale = localeOf(req);
            const stories = yield Story.findAll({
                where: yield liveWhere(req),
                include: [...mediaInclude(Story, 'cover'), { model: StorySlide, as: 'slides', include: mediaInclude(StorySlide, 'image') }],
                order: [...ORDER, [{ model: StorySlide, as: 'slides' }, 'position', 'ASC'], [{ model: StorySlide, as: 'slides' }, 'id', 'ASC']],
            });
            const data = stories.map((s) => serializeStory(s, locale)).filter((s) => s.slides.length);
            return res.success({ status: 200, data: { locale, stories: data } });
        });
    }
    /**
     * GET /content/app-version?platform=ios&version=1.4.2 — whether the app
     * must, or is asked to, update. The app's own headers do too
     * (`x-app-platform`, `x-app-version`).
     */
    appVersion(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const platform = platformOf((_a = req.query.platform) !== null && _a !== void 0 ? _a : req.headers['x-app-platform']);
            if (!platform)
                return res.error({ status: 400, errors: ['invalid_platform'] });
            const asked = (_b = req.query.version) !== null && _b !== void 0 ? _b : req.headers['x-app-version'];
            const locale = localeOf(req);
            const update = yield appUpdateOf(platform, typeof asked === 'string' ? asked.trim() : null, locale);
            return res.success({ status: 200, data: Object.assign({ locale }, update) });
        });
    }
};
__decorate([
    Get('/content/languages'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHContentAppController.prototype, "languages", null);
__decorate([
    Get('/content/faq'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHContentAppController.prototype, "faq", null);
__decorate([
    Get('/content/contacts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHContentAppController.prototype, "contacts", null);
__decorate([
    Get('/content/legal'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHContentAppController.prototype, "legal", null);
__decorate([
    Get('/content/legal/:slug'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHContentAppController.prototype, "legalDocument", null);
__decorate([
    Get('/content/banners'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHContentAppController.prototype, "banners", null);
__decorate([
    Get('/content/stories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHContentAppController.prototype, "stories", null);
__decorate([
    Get('/content/app-version'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHContentAppController.prototype, "appVersion", null);
ETHContentAppController = __decorate([
    Controller()
], ETHContentAppController);
export default ETHContentAppController;
