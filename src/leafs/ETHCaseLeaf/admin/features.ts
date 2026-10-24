import { attachmentsFromMedia } from '../services/cases.js'
import {
    CASES_COLLECTION,
    COMMENTS_COLLECTION,
    SLA_POLICIES_COLLECTION,
    attachmentsAllowed,
    caseModels,
    readOnlyReason,
    staffNameOf,
    wordsOf,
} from '../services/options.js'
import { FINISHED_STATUSES } from '../services/statuses.js'

/**
 * The cases' actions and hooks, on the collections of `collections.ts`.
 * Registered before them: a collection resolves its hooks when it is registered.
 */

export const ASSIGN_TO_ME_ACTION = 'case:assign-to-me'

export function registerCaseActions(adminLeaf: any): void {
    if (adminLeaf.actions.get?.(ASSIGN_TO_ME_ACTION)) return

    adminLeaf.actions.register(ASSIGN_TO_ME_ACTION, {
        meta: {
            label: 'Assign to Me',
            description: `Take this ${wordsOf().case.toLowerCase()}: its alerts come to you`,
            icon: 'user-check',
            color: 'primary',
            category: 'cases',
        },

        handler: async (record: any, _data: any, req: any) => {
            const reason = readOnlyReason(record)
            if (reason) return { success: false, error: reason }
            const staffId = req?.user?.id
            if (!staffId) return { success: false, error: 'Sign in again.' }
            if (record.assigned_to_user_id === staffId) return { success: false, error: 'It is already yours.' }
            if (FINISHED_STATUSES.includes(record.status)) return { success: false, error: `This ${wordsOf().case.toLowerCase()} is over.` }
            await record.update({ assigned_to_user_id: staffId })
            return { success: true, data: { id: record.id } }
        },
    })
}

/** The ids of the files a form sends: ids or `{ id }`. */
const mediaIdsOf = (value: unknown): unknown[] =>
    (Array.isArray(value) ? value : []).map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>).id : entry))

const hours = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null
    const n = Number(value)
    if (!Number.isFinite(n) || n <= 0) throw new Error('Hours are a number above 0, or empty.')
    return n
}

export function registerCaseHooks(adminLeaf: any): void {
    const words = wordsOf()

    // A case handled elsewhere: a change made here would be undone there.
    adminLeaf.hooks.register('cases:read-only', {
        collection: CASES_COLLECTION,
        description: `${words.cases} handled elsewhere cannot be changed here`,
        beforeUpdate: async (record: any, data: any) => {
            const reason = readOnlyReason(record)
            if (reason) throw new Error(reason)
            return data
        },
    })

    // A message from the back-office is the staff's side of the conversation,
    // signed with the name the customer sees; the model's hook tells them.
    adminLeaf.hooks.register('case-comments:staff-author', {
        collection: COMMENTS_COLLECTION,
        description: 'Messages written here are signed by the staff member',
        beforeCreate: async (data: any, req: any) => {
            const kase = data?.case_id ? await caseModels().Case.findByPk(data.case_id) : null
            if (!kase) throw new Error(`Pick the ${words.case.toLowerCase()} to answer.`)
            const reason = readOnlyReason(kase)
            if (reason) throw new Error(reason)

            const staff = req?.user
            const internal = data.internal === true || data.internal === 'true'
            const wanted = mediaIdsOf(data.attachments)
            if (wanted.length && !attachmentsAllowed(internal)) {
                throw new Error(internal ? 'Files cannot be added here.' : 'Files can only go on internal notes.')
            }
            return {
                ...data,
                author_kind: 'staff',
                author_user_id: staff?.id ?? null,
                author_name: staffNameOf(staff),
                internal,
                attachments: await attachmentsFromMedia(staff?.id, wanted),
            }
        },
    })

    const checkPolicy = (data: any) => ({
        ...data,
        ...('first_response_hours' in data ? { first_response_hours: hours(data.first_response_hours) } : {}),
        ...('resolution_hours' in data ? { resolution_hours: hours(data.resolution_hours) } : {}),
    })
    adminLeaf.hooks.register('case-sla-policies:hours', {
        collection: SLA_POLICIES_COLLECTION,
        description: 'Response times are positive hours',
        beforeCreate: async (data: any) => {
            const checked = checkPolicy(data)
            if (!checked.first_response_hours && !checked.resolution_hours) throw new Error('Set a time to answer, to resolve, or both.')
            return checked
        },
        beforeUpdate: async (_record: any, data: any) => checkPolicy(data),
    })
}
