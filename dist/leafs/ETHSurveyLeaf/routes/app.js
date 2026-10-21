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
import { activeKeys, questionsFor, readAnswers, surveyByKey } from '../services/forms.js';
import { defaultLocaleOf, kindOf, languageOf, scaleOf } from '../services/options.js';
import { state } from '../services/state.js';
function userIdOf(req) {
    var _a, _b;
    return Number(typeof ((_a = req.user) === null || _a === void 0 ? void 0 : _a.get) === 'function' ? req.user.get('id') : (_b = req.user) === null || _b === void 0 ? void 0 : _b.id);
}
/** The app's language: `?locale=`, then the app's header, then the phone's. */
function localeOf(req) {
    var _a, _b, _c, _d;
    return ((_d = (_c = (_b = languageOf((_a = req.query) === null || _a === void 0 ? void 0 : _a.locale)) !== null && _b !== void 0 ? _b : languageOf(req.headers['x-app-locale'])) !== null && _c !== void 0 ? _c : languageOf(req.headers['accept-language'])) !== null && _d !== void 0 ? _d : defaultLocaleOf(state.config));
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
     * The survey waiting for the signed-in person, worded in their language,
     * or `null`. One at a time, the oldest first.
     */
    pending(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const now = new Date();
            // A survey turned off no longer shows the questions still waiting.
            const known = yield activeKeys();
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
            const survey = row && (yield surveyByKey(row.survey));
            if (!row || !((_a = survey === null || survey === void 0 ? void 0 : survey.questions) === null || _a === void 0 ? void 0 : _a.length))
                return res.success({ status: 200, data: null });
            const locale = localeOf(req);
            const kind = kindOf(survey.questions);
            const questions = questionsFor(survey, locale);
            const written = questions.find((q) => q.type === 'text');
            return res.success({
                status: 200,
                data: {
                    id: row.id,
                    survey: survey.key,
                    kind,
                    scale: scaleOf(kind),
                    questions,
                    subject_label: row.subject_label,
                    locale,
                    // Read by the app before several questions: the score, then one comment.
                    question: questions[0].label,
                    comment_prompt: (_b = written === null || written === void 0 ? void 0 : written.label) !== null && _b !== void 0 ? _b : null,
                    low_label: (_c = questions[0].low_label) !== null && _c !== void 0 ? _c : null,
                    high_label: (_d = questions[0].high_label) !== null && _d !== void 0 ? _d : null,
                },
            });
        });
    }
    /** POST /surveys/:id/answer { answers: { <question id>: value } } — or `{ score, comment? }` from an older app. */
    answer(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield ownRow(req);
            const survey = row && (yield surveyByKey(row.survey));
            if (!row || !survey)
                return res.error({ status: 404, errors: ['not_found'] });
            if (row.status === 'answered')
                return res.success({ status: 200, data: { id: row.id, status: row.status } });
            if (row.status !== 'pending' || !survey.active)
                return res.error({ status: 410, errors: ['closed'] });
            const read = readAnswers(survey, req.body);
            if ('error' in read)
                return res.error({ status: 422, errors: [read.error] });
            // Answered even a little late: the person took the time.
            yield row.update({
                status: 'answered',
                score: read.score,
                comment: read.comment,
                answers: read.answers,
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
