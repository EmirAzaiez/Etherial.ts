import etherial from 'etherial'

import { currentActor } from '../../ETHAdminLeaf/features/audit.js'
import { CASES_COLLECTION, alertOn, state, type CaseAlerts, type CaseNoticeKind } from './options.js'

/**
 * Tells the customer through the project's `notify`. Awaited, as the project
 * may expect its notification written once the write returns; its failure
 * only prints.
 */
export async function notifyCustomer(kase: any, kind: CaseNoticeKind, comment?: any): Promise<void> {
    const notify = state.config.notify
    if (!notify || !kase?.user_id) return
    try {
        await notify({ kind, case: kase, comment })
    } catch (error: any) {
        console.error(`[ETHCaseLeaf] Could not tell the customer of case #${kase.id} (${kind}):`, error?.message || error)
    }
}

const nameOf = (kase: any) => kase.reference || `Case #${kase.id}`

const excerpt = (text: string | null | undefined, length = 140): string | undefined => {
    const flat = String(text ?? '').replace(/\s+/g, ' ').trim()
    if (!flat) return undefined
    return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat
}

/**
 * A line in the staff's bell (ETHAdminLeaf), in the background: to the
 * assignee when there is one and `assignee` is asked, else to whoever may
 * change cases. The person who did it is never told.
 */
export function alertStaff(
    kind: keyof CaseAlerts,
    kase: any,
    message: { type: string; title: string; body?: string | null; assignee?: boolean; userIds?: number[] },
): void {
    const adminLeaf = (etherial as any).eth_admin_leaf
    if (!alertOn(kind) || !adminLeaf?.notify || adminLeaf.notificationsEnabled?.() === false) return
    const { actor } = currentActor()
    const actorId = actor.type === 'user' ? (actor.id ?? undefined) : undefined

    const to = message.userIds?.length
        ? { userIds: message.userIds }
        : message.assignee && kase.assigned_to_user_id
          ? { userIds: [kase.assigned_to_user_id] }
          : { permission: { collection: CASES_COLLECTION, permission: 'update' } }

    adminLeaf
        .notify({
            to,
            type: message.type,
            title: message.title,
            body: excerpt(message.body),
            link: `/${CASES_COLLECTION}/${kase.id}`,
            collection: CASES_COLLECTION,
            recordId: kase.id,
            actorId,
        })
        .catch((error: any) => console.error(`[ETHCaseLeaf] Could not alert staff on case #${kase.id} (${message.type}):`, error?.message || error))
}

export const caseTitle = {
    created: (kase: any) => `New: ${nameOf(kase)}`,
    reply: (kase: any) => `${nameOf(kase)}: the customer answered`,
    rejected: (kase: any) => `${nameOf(kase)}: the customer says it is not fixed`,
    assigned: (kase: any) => `${nameOf(kase)} is assigned to you`,
    overdue: (kase: any) => `${nameOf(kase)} is overdue`,
}

export { excerpt }
