import { Etherial } from 'etherial';
import { ETHCaseLeafConfig } from './services/options.js';
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
    readonly etherial_module_name = "eth_case_leaf";
    config: ETHCaseLeafConfig;
    private routes;
    constructor(config?: ETHCaseLeafConfig);
    /** Lifecycle: beforeRun — the leaf's tables, and the sync's, go to the database before it syncs. */
    beforeRun({ database }: Etherial): void;
    /**
     * Lifecycle: run — routes, the back-office and the clock. The back-office
     * is registered here, before the admin leaf runs: hooks before their
     * collections (a collection reads its hooks when registered), and the
     * collections before the admin leaf installs its history on them.
     */
    run({ http }: Etherial): void;
    /** Lifecycle: afterRun — the sent records in the back-office, when there is a target. */
    afterRun(): void;
}
