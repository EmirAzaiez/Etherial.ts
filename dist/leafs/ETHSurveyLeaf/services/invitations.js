var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from 'etherial';
import { Op, UniqueConstraintError } from 'sequelize';
import { SurveyResponse } from '../models/SurveyResponse.js';
import { state } from './state.js';
const DAY_MS = 24 * 3600 * 1000;
export function surveyOf(key) {
    var _a;
    return (_a = state.config.surveys) === null || _a === void 0 ? void 0 : _a.find((s) => s.key === key);
}
function sequelize() {
    var _a;
    return (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize;
}
function userById(id) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        const model = (_b = (_a = state.config.users) === null || _a === void 0 ? void 0 : _a.model) !== null && _b !== void 0 ? _b : 'User';
        return (_e = (_d = (_c = sequelize()) === null || _c === void 0 ? void 0 : _c.models) === null || _d === void 0 ? void 0 : _d[model]) === null || _e === void 0 ? void 0 : _e.findByPk(id).catch(() => null);
    });
}
/**
 * Puts a survey to someone. It opens after the survey's delay and closes when
 * it expires. Nobody is asked twice about the same thing, nor more than once
 * per cooldown, whatever the survey.
 */
export function invite(input) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const survey = surveyOf(input.survey);
        if (!survey)
            return { invited: false, reason: 'unknown_survey' };
        const userId = Number(input.user_id);
        if (!Number.isInteger(userId) || userId <= 0)
            return { invited: false, reason: 'no_user' };
        if (state.config.excludeUser) {
            const user = yield userById(userId);
            if (user && state.config.excludeUser(user))
                return { invited: false, reason: 'excluded' };
        }
        const subjectType = String((_b = (_a = input.subject) === null || _a === void 0 ? void 0 : _a.type) !== null && _b !== void 0 ? _b : '').slice(0, 64);
        const subjectId = String((_d = (_c = input.subject) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : '').slice(0, 64);
        const already = yield SurveyResponse.count({
            where: { survey: survey.key, user_id: userId, subject_type: subjectType, subject_id: subjectId },
        });
        if (already)
            return { invited: false, reason: 'already_asked' };
        const cooldown = (_e = state.config.cooldownDays) !== null && _e !== void 0 ? _e : 30;
        if (cooldown > 0) {
            const recent = yield SurveyResponse.count({
                where: { user_id: userId, created_at: { [Op.gte]: new Date(Date.now() - cooldown * DAY_MS) } },
            });
            if (recent)
                return { invited: false, reason: 'cooldown' };
        }
        const at = (_f = input.at) !== null && _f !== void 0 ? _f : new Date();
        const opens = new Date(at.getTime() + Math.max(0, (_g = survey.delayMinutes) !== null && _g !== void 0 ? _g : 0) * 60 * 1000);
        const closes = new Date(opens.getTime() + Math.max(1, (_h = survey.expiresAfterDays) !== null && _h !== void 0 ? _h : 7) * DAY_MS);
        try {
            const row = yield SurveyResponse.create({
                survey: survey.key,
                user_id: userId,
                subject_type: subjectType,
                subject_id: subjectId,
                subject_label: ((_j = input.subject) === null || _j === void 0 ? void 0 : _j.label) ? String(input.subject.label).slice(0, 255) : null,
                status: 'pending',
                available_at: opens,
                expires_at: closes,
            });
            if (opens.getTime() <= Date.now())
                void notifyDue();
            return { invited: true, id: row.id };
        }
        catch (err) {
            // Two hooks raced on the same change: the other one asked.
            if (err instanceof UniqueConstraintError)
                return { invited: false, reason: 'already_asked' };
            throw err;
        }
    });
}
/**
 * Tells people their question is open, once each. A row is claimed before
 * `notify` runs, so two servers never send the same push.
 */
export function notifyDue() {
    return __awaiter(this, void 0, void 0, function* () {
        const notify = state.config.notify;
        if (!notify)
            return;
        const now = new Date();
        const due = yield SurveyResponse.findAll({
            where: { status: 'pending', notified_at: null, available_at: { [Op.lte]: now }, expires_at: { [Op.gt]: now } },
            order: [['available_at', 'ASC']],
            limit: 100,
        });
        for (const row of due) {
            const [claimed] = yield SurveyResponse.update({ notified_at: now }, { where: { id: row.id, notified_at: null } });
            if (!claimed)
                continue;
            const survey = surveyOf(row.survey);
            if (!survey)
                continue;
            try {
                yield notify({ id: row.id, survey: row.survey, user_id: row.user_id, subject_label: row.subject_label }, survey);
            }
            catch (err) {
                console.error(`[ETHSurveyLeaf] Could not tell user ${row.user_id} about survey ${row.survey}:`, (err === null || err === void 0 ? void 0 : err.message) || err);
            }
        }
    });
}
/** Questions left open past their date are closed, so the lists and the response rate stay right. */
export function expireDue() {
    return __awaiter(this, void 0, void 0, function* () {
        const [count] = yield SurveyResponse.update({ status: 'expired' }, {
            where: { status: 'pending', expires_at: { [Op.lte]: new Date() } },
        });
        return count;
    });
}
/** Hooks each trigger on its model. Unknown models are reported, not fatal. */
export function attachTriggers(triggers) {
    var _a, _b, _c;
    const models = (_b = (_a = sequelize()) === null || _a === void 0 ? void 0 : _a.models) !== null && _b !== void 0 ? _b : {};
    for (const trigger of triggers) {
        const Model = models[trigger.model];
        if (!Model) {
            console.warn(`[ETHSurveyLeaf] Trigger for "${trigger.survey}": no model named ${trigger.model}`);
            continue;
        }
        if (!surveyOf(trigger.survey)) {
            console.warn(`[ETHSurveyLeaf] Trigger on ${trigger.model}: no survey named "${trigger.survey}"`);
            continue;
        }
        const on = (_c = trigger.on) !== null && _c !== void 0 ? _c : 'update';
        const run = (created) => (row, options) => {
            var _a;
            // Decided now: `previous()` forgets the old values once the save is done.
            let asked = false;
            try {
                asked = trigger.when(row, (field) => { var _a; return (created ? undefined : (_a = row.previous) === null || _a === void 0 ? void 0 : _a.call(row, field)); });
            }
            catch (err) {
                console.error(`[ETHSurveyLeaf] Trigger for "${trigger.survey}" on ${trigger.model} failed:`, (err === null || err === void 0 ? void 0 : err.message) || err);
            }
            if (!asked)
                return;
            // Asked once the change is committed, so a rollback asks nothing.
            const go = () => void fire(trigger, row);
            if ((_a = options === null || options === void 0 ? void 0 : options.transaction) === null || _a === void 0 ? void 0 : _a.afterCommit)
                options.transaction.afterCommit(go);
            else
                go();
        };
        if (on === 'create' || on === 'both')
            Model.addHook('afterCreate', `eth-survey-${trigger.survey}`, run(true));
        if (on === 'update' || on === 'both')
            Model.addHook('afterUpdate', `eth-survey-${trigger.survey}`, run(false));
    }
}
function fire(trigger, row) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const userId = yield trigger.user(row);
            if (!userId)
                return;
            const label = trigger.subject ? yield trigger.subject(row) : null;
            yield invite({
                survey: trigger.survey,
                user_id: Number(userId),
                subject: { type: trigger.model, id: (_b = (_a = row.get) === null || _a === void 0 ? void 0 : _a.call(row, 'id')) !== null && _b !== void 0 ? _b : row.id, label },
            });
        }
        catch (err) {
            console.error(`[ETHSurveyLeaf] Trigger for "${trigger.survey}" on ${trigger.model} failed:`, (err === null || err === void 0 ? void 0 : err.message) || err);
        }
    });
}
