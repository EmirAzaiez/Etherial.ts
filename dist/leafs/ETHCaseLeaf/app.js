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
import * as path from 'path';
import { fileURLToPath } from 'url';
import { runExclusive } from '../../components/database/lock.js';
import { registerSync, registerSyncAdmin, startSync } from '../../components/sync/index.js';
import { registerMediaReferences } from '../ETHMediaLeaf/models/Media.js';
import { registerCaseActions, registerCaseHooks } from './admin/features.js';
import { registerCaseCollections } from './admin/collections.js';
import { CaseCannedReply } from './models/CaseCannedReply.js';
import { CaseEvent } from './models/CaseEvent.js';
import { CaseSlaPolicy } from './models/CaseSlaPolicy.js';
import { caseMediaIds } from './services/cases.js';
import { flagOverdueCases } from './services/clock.js';
import { CASES_COLLECTION, COMMENTS_COLLECTION, caseModels, state } from './services/options.js';
import { watchSurveyAnswers } from './services/survey.js';
export * from './services/options.js';
export * from './services/statuses.js';
export * from './models/Case.js';
export * from './models/CaseComment.js';
export * from './models/CaseEvent.js';
export * from './models/CaseCannedReply.js';
export * from './models/CaseSlaPolicy.js';
export { openCase, replyToCase, confirmResolution, rateCase, attachmentsFromMedia, renderCannedReply, cannedRepliesFor, caseMediaIds } from './services/cases.js';
export { dueDates, isOverdue, attentionOf, policyFor } from './services/sla.js';
export { flagOverdueCases } from './services/clock.js';
export { logCaseEvent } from './services/events.js';
export { caseClosedSurveyEvent } from './services/survey.js';
export { ASSIGN_TO_ME_ACTION } from './admin/features.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
/**
 * ETHCaseLeaf — customer requests (maintenance, complaints, questions) handled
 * by our staff in our back-office.
 *
 * Staff answer in a conversation (replies the customer reads, internal notes
 * they never see, files), assign, set the priority and the status; response
 * times (SLA) put a due time on each case and the clock flags and alerts the
 * late ones; every change is kept in the case's history.
 *
 * The project owns the tables (it extends BaseCase and BaseCaseComment), what
 * a case is about (`subject`), how the customer is told (`notify`) and its app
 * routes, which call the services. A case handled elsewhere (`readOnly`) is
 * only shown. With `sync`, each case is copied to an outside system after
 * commit.
 */
export default class ETHCaseLeaf {
    constructor(config = {}) {
        this.etherial_module_name = 'eth_case_leaf';
        this.routes = [];
        this.config = config;
        state.config = config;
        this.routes.push({ route: path.join(__dirname, 'routes/admin'), methods: ['thread', 'reply'] });
    }
    /** Lifecycle: beforeRun — the leaf's tables, and the sync's, go to the database before it syncs. */
    beforeRun({ database }) {
        database === null || database === void 0 ? void 0 : database.addModels([CaseEvent, CaseCannedReply, CaseSlaPolicy]);
        if (this.config.sync) {
            registerSync(CASES_COLLECTION, Object.assign(Object.assign({}, this.config.sync), { model: () => caseModels().Case, 
                // The clock's and the activity's columns change nothing over there.
                track: { ignore: ['attention', 'awaiting_reply_since', 'first_response_due_at', 'resolution_due_at', 'last_activity_at', 'status_entered_at'] } }));
        }
        if (this.config.syncComments) {
            registerSync(COMMENTS_COLLECTION, Object.assign(Object.assign({}, this.config.syncComments), { model: () => caseModels().CaseComment, 
                // Internal notes stay here.
                track: { when: (comment) => !comment.internal } }));
        }
    }
    /**
     * Lifecycle: run — routes, the back-office and the clock. The back-office
     * is registered here, before the admin leaf runs: hooks before their
     * collections (a collection reads its hooks when registered), and the
     * collections before the admin leaf installs its history on them.
     */
    run({ http }) {
        var _a, _b, _c;
        caseModels();
        (_a = http === null || http === void 0 ? void 0 : http.routes_leafs) === null || _a === void 0 ? void 0 : _a.push(...this.routes);
        startSync();
        const adminLeaf = etherial.eth_admin_leaf;
        if (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.registerCollection) {
            registerCaseActions(adminLeaf);
            registerCaseHooks(adminLeaf);
            registerCaseCollections(adminLeaf);
        }
        watchSurveyAnswers();
        registerMediaReferences(caseMediaIds);
        const tick = () => __awaiter(this, void 0, void 0, function* () {
            try {
                yield runExclusive('eth_case.tick', { ttlMs: 50 * 1000, release: false }, () => flagOverdueCases());
            }
            catch (err) {
                console.error('[ETHCaseLeaf] The SLA clock failed:', (err === null || err === void 0 ? void 0 : err.message) || err);
            }
        });
        // Not at boot: the tables may not be synced yet.
        (_c = (_b = setInterval(tick, 60 * 1000)).unref) === null || _c === void 0 ? void 0 : _c.call(_b);
    }
    /** Lifecycle: afterRun — the sent records in the back-office, when there is a target. */
    afterRun() {
        const adminLeaf = etherial.eth_admin_leaf;
        if (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.registerCollection)
            registerSyncAdmin(adminLeaf);
    }
}
