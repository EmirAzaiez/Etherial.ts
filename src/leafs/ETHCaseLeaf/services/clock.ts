import { CaseEventType } from '../models/CaseEvent.js'
import { logCaseEvent } from './events.js'
import { alertStaff, caseTitle } from './notices.js'
import { caseModels, readOnlyReason } from './options.js'
import { overdueWhere } from './sla.js'
import { CaseAttention } from './statuses.js'

const BATCH = 200

/**
 * Flags the cases gone past their due time, each once: the conditional write
 * only lands on a case not flagged yet, so two servers never alert twice. The
 * flag is the clock's alone and written without hooks: it changes nothing the
 * customer, the history of fields or a sync care about.
 */
export async function flagOverdueCases(now = new Date()): Promise<number> {
    const { Case } = caseModels()
    const late = await Case.findAll({ where: overdueWhere(now), order: [['id', 'ASC']], limit: BATCH })
    let flagged = 0

    for (const kase of late) {
        // Handled elsewhere since: its clocks no longer run.
        if (readOnlyReason(kase)) {
            await Case.update({ first_response_due_at: null, resolution_due_at: null, attention: null }, { where: { id: kase.id }, hooks: false, silent: true })
            continue
        }
        const [count] = await Case.update({ attention: CaseAttention.OVERDUE }, { where: { id: kase.id, ...overdueWhere(now) }, hooks: false, silent: true })
        if (!count) continue
        flagged++

        const unanswered = !kase.first_response_at && kase.first_response_due_at && new Date(kase.first_response_due_at) < now
        const note = unanswered ? 'No answer in time' : 'Not resolved in time'
        logCaseEvent(kase.id, CaseEventType.OVERDUE, { to: unanswered ? 'first_response' : 'resolution', note })
        alertStaff('overdue', kase, { type: 'case_overdue', title: caseTitle.overdue(kase), body: `${note}: ${kase.subject}`, assignee: true })
    }
    return flagged
}
