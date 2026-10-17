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
import { Controller, Get, Post } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { SurveyResponse } from '../models/SurveyResponse.js';
import { surveyOf } from '../services/invitations.js';
import { kindOf, languageOf, localize, scaleOf } from '../services/options.js';
import { state } from '../services/state.js';
function userIdOf(req) {
    var _a, _b;
    return Number(typeof ((_a = req.user) === null || _a === void 0 ? void 0 : _a.get) === 'function' ? req.user.get('id') : (_b = req.user) === null || _b === void 0 ? void 0 : _b.id);
}
/** The app's language: `?locale=`, then the app's header, then the phone's. */
function localeOf(req) {
    var _a, _b, _c, _d, _e;
    return ((_e = (_d = (_c = (_b = languageOf((_a = req.query) === null || _a === void 0 ? void 0 : _a.locale)) !== null && _b !== void 0 ? _b : languageOf(req.headers['x-app-locale'])) !== null && _c !== void 0 ? _c : languageOf(req.headers['accept-language'])) !== null && _d !== void 0 ? _d : state.config.defaultLocale) !== null && _e !== void 0 ? _e : 'en');
}
function ownRow(req) {
    return __awaiter(this, void 0, void 0, function* () {
        const id = Number(req.params.id);
        if (!Number.isInteger(id))
            return null;
        return SurveyResponse.findOne({ where: { id, user_id: userIdOf(req) } });
    });
}
function clip(value, max) {
    if (value === undefined || value === null)
        return null;
    const s = String(value).trim();
    return s ? s.slice(0, max) : null;
}
let ETHSurveyAppController = class ETHSurveyAppController {
    /**
     * GET /surveys/pending
     *
     * The question waiting for the signed-in person, worded in their language,
     * or `null`. One at a time, the oldest first.
     */
    pending(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const now = new Date();
            const known = ((_a = state.config.surveys) !== null && _a !== void 0 ? _a : []).map((s) => s.key);
            const row = known.length
                ? yield SurveyResponse.findOne({
                    where: {
                        user_id: userIdOf(req),
                        status: 'pending',
                        survey: known,
                        available_at: { [Op.lte]: now },
                        expires_at: { [Op.gt]: now },
                    },
                    order: [['available_at', 'ASC']],
                })
                : null;
            const survey = row && surveyOf(row.survey);
            if (!row || !survey)
                return res.success({ status: 200, data: null });
            const locale = localeOf(req);
            const fallback = (_b = state.config.defaultLocale) !== null && _b !== void 0 ? _b : 'en';
            const kind = kindOf(survey);
            return res.success({
                status: 200,
                data: {
                    id: row.id,
                    survey: survey.key,
                    kind,
                    scale: scaleOf(kind),
                    question: localize(survey.question, locale, fallback),
                    comment_prompt: localize(survey.commentPrompt, locale, fallback),
                    low_label: localize(survey.lowLabel, locale, fallback),
                    high_label: localize(survey.highLabel, locale, fallback),
                    subject_label: row.subject_label,
                    locale,
                },
            });
        });
    }
    /** POST /surveys/:id/answer { score, comment? } */
    answer(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const row = yield ownRow(req);
            const survey = row && surveyOf(row.survey);
            if (!row || !survey)
                return res.error({ status: 404, errors: ['not_found'] });
            if (row.status === 'answered')
                return res.success({ status: 200, data: { id: row.id, status: row.status } });
            if (row.status !== 'pending')
                return res.error({ status: 410, errors: ['closed'] });
            const { min, max } = scaleOf(kindOf(survey));
            const score = Number((_a = req.body) === null || _a === void 0 ? void 0 : _a.score);
            if (!Number.isInteger(score) || score < min || score > max) {
                return res.error({ status: 422, errors: [`score must be a whole number from ${min} to ${max}`] });
            }
            // Answered even a little late: the person took the time.
            yield row.update({
                status: 'answered',
                score,
                comment: clip((_b = req.body) === null || _b === void 0 ? void 0 : _b.comment, 2000),
                locale: localeOf(req),
                platform: clip(req.headers['x-app-platform'], 16),
                app_version: clip(req.headers['x-app-version'], 32),
                answered_at: new Date(),
            });
            return res.success({ status: 200, data: { id: row.id, status: row.status } });
        });
    }
    /** POST /surveys/:id/dismiss — "Not now": the question is not asked again. */
    dismiss(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield ownRow(req);
            if (!row)
                return res.error({ status: 404, errors: ['not_found'] });
            if (row.status === 'pending')
                yield row.update({ status: 'dismissed' });
            return res.success({ status: 200, data: { id: row.id, status: row.status } });
        });
    }
};
__decorate([
    Get('/surveys/pending'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHSurveyAppController.prototype, "pending", null);
__decorate([
    Post('/surveys/:id/answer'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHSurveyAppController.prototype, "answer", null);
__decorate([
    Post('/surveys/:id/dismiss'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHSurveyAppController.prototype, "dismiss", null);
ETHSurveyAppController = __decorate([
    Controller()
], ETHSurveyAppController);
export default ETHSurveyAppController;
