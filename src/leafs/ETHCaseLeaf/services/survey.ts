import etherial from 'etherial'

import type { SurveyEvent } from '../../ETHSurveyLeaf/services/options.js'
import { openCase } from './cases.js'
import { kindsOf, labelIn, state } from './options.js'
import { CaseStatus } from './statuses.js'

/**
 * The moment ETHSurveyLeaf asks after: a case closed. Put it in the survey
 * leaf's `events`; each part can be changed.
 *
 *     events: [caseClosedSurveyEvent()]
 */
export function caseClosedSurveyEvent(overrides: Partial<SurveyEvent> = {}): SurveyEvent {
    return {
        key: 'case_closed',
        label: 'A request is closed',
        description: 'Asked once the request is closed, whether the customer confirmed it or staff closed it.',
        model: state.config.models?.Case ?? 'Case',
        on: 'update',
        when: (row, previous) => row.status === CaseStatus.CLOSED && previous('status') !== CaseStatus.CLOSED,
        user: (row) => row.user_id,
        subject: (row) => labelIn(kindsOf(), row.kind) || null,
        target: {
            label: 'Request type',
            value: (row) => row.kind,
            options: () => kindsOf().map(({ value, label }) => ({ value, label })),
        },
        ...overrides,
    }
}

const HOOK = 'eth_case.from_survey'

/**
 * With `fromSurvey`, an answer the project judges bad opens a case: once,
 * when the answer comes in. Its failure only prints, the answer is saved.
 */
export function watchSurveyAnswers(): void {
    const fromSurvey = state.config.fromSurvey
    const SurveyResponse = (etherial as any).database?.sequelize?.models?.SurveyResponse
    if (!fromSurvey || !SurveyResponse) return
    SurveyResponse.removeHook('afterUpdate', HOOK)
    SurveyResponse.addHook('afterUpdate', HOOK, (response: any, options: any) => {
        if (response.status !== 'answered' || response.previous('status') === 'answered') return
        const open = async () => {
            const draft = await fromSurvey(response)
            if (draft) await openCase({ channel: 'SURVEY', ...draft })
        }
        const run = () => open().catch((error: any) => console.error(`[ETHCaseLeaf] Could not open a case from survey answer #${response.id}:`, error?.message || error))
        if (options?.transaction?.afterCommit) options.transaction.afterCommit(run)
        else void run()
    })
}
