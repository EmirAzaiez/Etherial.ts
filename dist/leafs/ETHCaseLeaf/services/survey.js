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
import { openCase } from './cases.js';
import { kindsOf, labelIn, state } from './options.js';
import { CaseStatus } from './statuses.js';
/**
 * The moment ETHSurveyLeaf asks after: a case closed. Put it in the survey
 * leaf's `events`; each part can be changed.
 *
 *     events: [caseClosedSurveyEvent()]
 */
export function caseClosedSurveyEvent(overrides = {}) {
    var _a, _b;
    return Object.assign({ key: 'case_closed', label: 'A request is closed', description: 'Asked once the request is closed, whether the customer confirmed it or staff closed it.', model: (_b = (_a = state.config.models) === null || _a === void 0 ? void 0 : _a.Case) !== null && _b !== void 0 ? _b : 'Case', on: 'update', when: (row, previous) => row.status === CaseStatus.CLOSED && previous('status') !== CaseStatus.CLOSED, user: (row) => row.user_id, subject: (row) => labelIn(kindsOf(), row.kind) || null, target: {
            label: 'Request type',
            value: (row) => row.kind,
            options: () => kindsOf().map(({ value, label }) => ({ value, label })),
        } }, overrides);
}
const HOOK = 'eth_case.from_survey';
/**
 * With `fromSurvey`, an answer the project judges bad opens a case: once,
 * when the answer comes in. Its failure only prints, the answer is saved.
 */
export function watchSurveyAnswers() {
    var _a, _b, _c;
    const fromSurvey = state.config.fromSurvey;
    const SurveyResponse = (_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) === null || _c === void 0 ? void 0 : _c.SurveyResponse;
    if (!fromSurvey || !SurveyResponse)
        return;
    SurveyResponse.removeHook('afterUpdate', HOOK);
    SurveyResponse.addHook('afterUpdate', HOOK, (response, options) => {
        var _a;
        if (response.status !== 'answered' || response.previous('status') === 'answered')
            return;
        const open = () => __awaiter(this, void 0, void 0, function* () {
            const draft = yield fromSurvey(response);
            if (draft)
                yield openCase(Object.assign({ channel: 'SURVEY' }, draft));
        });
        const run = () => open().catch((error) => console.error(`[ETHCaseLeaf] Could not open a case from survey answer #${response.id}:`, (error === null || error === void 0 ? void 0 : error.message) || error));
        if ((_a = options === null || options === void 0 ? void 0 : options.transaction) === null || _a === void 0 ? void 0 : _a.afterCommit)
            options.transaction.afterCommit(run);
        else
            void run();
    });
}
