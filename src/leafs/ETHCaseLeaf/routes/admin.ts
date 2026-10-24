import etherial from 'etherial'
import { Op } from 'sequelize'
import type { Request, Response } from 'express'
import { Controller, Get, Post } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { CaseCannedReply } from '../models/CaseCannedReply.js'
import { CaseEvent, CaseEventType } from '../models/CaseEvent.js'
import { attachmentsFromMedia, cannedRepliesFor, replyToCase } from '../services/cases.js'
import {
    CASES_COLLECTION,
    COMMENTS_COLLECTION,
    attachmentFolders,
    attachmentsAllowed,
    caseModels,
    categoriesOf,
    customersOf,
    kindsOf,
    labelIn,
    prioritiesOf,
    projectModel,
    readOnlyReason,
    state,
    wordsOf,
} from '../services/options.js'
import { ATTENTION_OPTIONS, statusOptions } from '../services/statuses.js'

type AuthedRequest = Request & { user: any }

const MAX_BODY = 10000

const positiveId = (value: unknown): number | null => {
    const n = Number(value)
    return Number.isInteger(n) && n > 0 ? n : null
}

const adminLeaf = () => (etherial as any).eth_admin_leaf

/** Whether `user` may run `method` on a collection, from the back-office only. */
async function allowed(user: any, collection: string, method: string): Promise<boolean> {
    const admin = adminLeaf()
    if (!admin || !(await admin.canAccessAdmin(user))) return false
    return admin.checkAccess(user, collection, method)
}

/** The people a thread names (customer, assignee, staff in the history), by id. */
async function peopleLabels(ids: (number | null | undefined)[]): Promise<Map<number, string>> {
    const wanted = [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
    const { model, displayField } = customersOf()
    const People = projectModel(model)
    if (!wanted.length || !People) return new Map()
    const rows = await People.findAll({ where: { id: { [Op.in]: wanted } } })
    const label = (row: any) => {
        const name = [row.first_name ?? row.firstname, row.last_name ?? row.lastname].filter(Boolean).join(' ').trim()
        return name || String(row[displayField] ?? row.email ?? `#${row.id}`)
    }
    return new Map(rows.map((row: any) => [row.id, label(row)]))
}

/** "Status: New → In progress", as staff read it. */
function eventText(event: any, people: Map<number, string>): string {
    const from = event.from_value
    const to = event.to_value
    const person = (id: string | null) => (id ? (people.get(Number(id)) ?? `#${id}`) : 'nobody')
    const change = (list: { value: string; label: string }[]) => `${labelIn(list, from) || '—'} → ${labelIn(list, to) || '—'}`
    switch (event.type) {
        case CaseEventType.CREATED:
            return `${wordsOf().case} opened`
        case CaseEventType.STATUS:
            return `Status: ${change(statusOptions())}`
        case CaseEventType.REOPENED:
            return `Reopened: ${change(statusOptions())}`
        case CaseEventType.ASSIGNED:
            return to ? `Assigned to ${person(to)}` : `Unassigned (was ${person(from)})`
        case CaseEventType.PRIORITY:
            return `Priority: ${change(prioritiesOf())}`
        case CaseEventType.CATEGORY:
            return `Category: ${change(categoriesOf())}`
        case CaseEventType.KIND:
            return `Type: ${change(kindsOf())}`
        case CaseEventType.CONFIRMED:
            return `The ${wordsOf().customer.toLowerCase()} confirmed it is fixed`
        case CaseEventType.REJECTED:
            return `The ${wordsOf().customer.toLowerCase()} says it is not fixed`
        case CaseEventType.RATED:
            return `Rated ${to}/5`
        case CaseEventType.OVERDUE:
            return to === 'first_response' ? 'Overdue: no answer in time' : 'Overdue: not resolved in time'
        default:
            return event.type
    }
}

function messageItem(comment: any) {
    return {
        type: 'message' as const,
        id: comment.id,
        at: comment.created_at,
        author_kind: comment.author_kind,
        author_name: comment.author_name,
        author_user_id: comment.author_user_id,
        body: comment.body,
        internal: !!comment.internal,
        attachments: comment.attachments ?? [],
    }
}

function eventItem(event: any, people: Map<number, string>) {
    return {
        type: 'event' as const,
        id: event.id,
        at: event.created_at,
        event: event.type,
        text: eventText(event, people),
        note: event.note,
        actor: event.actor_label ?? (event.actor_type === 'user' ? null : event.actor_type),
        source: event.source,
    }
}

/** What the panel shows above the conversation. */
function caseSummary(kase: any, people: Map<number, string>) {
    const subject = state.config.subject
    const status = statusOptions().find((o) => o.value === kase.status)
    return {
        id: kase.id,
        reference: kase.reference,
        subject: kase.subject,
        description: kase.description,
        kind: { value: kase.kind, label: labelIn(kindsOf(), kase.kind) },
        category: { value: kase.category, label: labelIn(categoriesOf(), kase.category) },
        priority: { value: kase.priority, label: labelIn(prioritiesOf(), kase.priority) },
        status: { value: kase.status, label: status?.label ?? kase.status, color: status?.color ?? null },
        attention: kase.attention ? (ATTENTION_OPTIONS.find((o) => o.value === kase.attention) ?? { value: kase.attention, label: kase.attention }) : null,
        customer: kase.user_id ? { id: kase.user_id, label: people.get(kase.user_id) ?? `#${kase.user_id}`, collection: customersOf().collection } : null,
        assignee: kase.assigned_to_user_id ? { id: kase.assigned_to_user_id, label: people.get(kase.assigned_to_user_id) ?? `#${kase.assigned_to_user_id}` } : null,
        about: subject && kase[subject.field] ? { id: kase[subject.field], label: subject.label ?? null, collection: subject.collection ?? null } : null,
        attachments: kase.attachments ?? [],
        issues: kase.issues ?? [],
        awaiting_reply_since: kase.awaiting_reply_since,
        first_response_due_at: kase.first_response_at ? null : kase.first_response_due_at,
        resolution_due_at: kase.resolution_due_at,
        first_response_at: kase.first_response_at,
        created_at: kase.created_at,
    }
}

@Controller()
export default class ETHCaseAdminController {
    /**
     * GET /admin/cases/:id/thread
     *
     * The case's conversation for the back-office panel: the messages (internal
     * notes too) and the history, merged by date; the canned replies ready to
     * use; and what the staff member may do here.
     */
    @Get('/admin/cases/:id/thread')
    @ShouldBeAuthenticated()
    public async thread(req: AuthedRequest, res: Response): Promise<any> {
        if (!(await allowed(req.user, CASES_COLLECTION, 'show'))) {
            return (res as any).error({ status: 403, errors: [`You cannot open ${wordsOf().cases.toLowerCase()}.`] })
        }
        const id = positiveId(req.params.id)
        const { Case, CaseComment } = caseModels()
        const kase = id ? await Case.findByPk(id) : null
        if (!kase) return (res as any).error({ status: 404, errors: [`This ${wordsOf().case.toLowerCase()} no longer exists.`] })

        const [comments, events, canReply, canUpdate] = await Promise.all([
            CaseComment.findAll({ where: { case_id: kase.id }, order: [['created_at', 'ASC'], ['id', 'ASC']] }),
            CaseEvent.findAll({ where: { case_id: kase.id }, order: [['created_at', 'ASC'], ['id', 'ASC']] }),
            allowed(req.user, COMMENTS_COLLECTION, 'create'),
            allowed(req.user, CASES_COLLECTION, 'update'),
        ])
        const assignedIds = events.filter((e: any) => e.type === CaseEventType.ASSIGNED).flatMap((e: any) => [e.from_value, e.to_value])
        const people = await peopleLabels([kase.user_id, kase.assigned_to_user_id, ...assignedIds])

        const items = [...comments.map(messageItem), ...events.map((event: any) => eventItem(event, people))].sort(
            (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
        )
        const readOnly = readOnlyReason(kase)

        return (res as any).success({
            status: 200,
            data: {
                case: caseSummary(kase, people),
                items,
                read_only: readOnly,
                can_reply: canReply && !readOnly,
                can_change_status: canUpdate && !readOnly,
                statuses: statusOptions(),
                canned_replies: canReply && !readOnly ? await cannedRepliesFor(kase, req.user) : [],
                attachments: { internal: attachmentsAllowed(true), public: attachmentsAllowed(false), folder: attachmentFolders()[0] },
                words: wordsOf(),
            },
        })
    }

    /**
     * POST /admin/cases/:id/replies
     * `{ body, internal?, attachments?: [mediaId], status?, canned_reply_id? }`
     *
     * A staff reply (the customer is told) or an internal note, signed by the
     * staff member; `status` moves the case in the same go. Files are Media
     * rows the staff member uploaded through the back-office first.
     */
    @Post('/admin/cases/:id/replies')
    @ShouldBeAuthenticated()
    public async reply(req: AuthedRequest, res: Response): Promise<any> {
        const input = (req.body ?? {}) as Record<string, any>
        const status = typeof input.status === 'string' && input.status ? input.status : null
        if (!(await allowed(req.user, COMMENTS_COLLECTION, 'create'))) {
            return (res as any).error({ status: 403, errors: [`You cannot answer ${wordsOf().cases.toLowerCase()}.`] })
        }
        if (status && !(await allowed(req.user, CASES_COLLECTION, 'update'))) {
            return (res as any).error({ status: 403, errors: [`You cannot change the status of ${wordsOf().cases.toLowerCase()}.`] })
        }

        const id = positiveId(req.params.id)
        const { Case } = caseModels()
        const kase = id ? await Case.findByPk(id) : null
        if (!kase) return (res as any).error({ status: 404, errors: [`This ${wordsOf().case.toLowerCase()} no longer exists.`] })
        const readOnly = readOnlyReason(kase)
        if (readOnly) return (res as any).error({ status: 409, errors: [readOnly] })

        const body = typeof input.body === 'string' ? input.body.trim() : ''
        if (!body) return (res as any).error({ status: 400, errors: ['Write the message first.'] })
        if (body.length > MAX_BODY) return (res as any).error({ status: 400, errors: [`The message is too long (${MAX_BODY} characters at most).`] })
        if (status && !statusOptions().some((o) => o.value === status)) {
            return (res as any).error({ status: 400, errors: ['That status does not exist.'] })
        }

        const internal = input.internal === true || input.internal === 'true'
        const wanted = Array.isArray(input.attachments) ? input.attachments : []
        if (wanted.length && !attachmentsAllowed(internal)) {
            return (res as any).error({ status: 400, errors: [internal ? 'Files cannot be added here.' : 'Files can only go on internal notes.'] })
        }
        let attachments
        try {
            attachments = await attachmentsFromMedia(req.user.id, wanted)
        } catch (error: any) {
            return (res as any).error({ status: 400, errors: [error?.message || 'A file could not be added.'] })
        }

        const comment = await replyToCase(kase, { body, internal, attachments, author: req.user, status })

        const cannedId = positiveId(input.canned_reply_id)
        if (cannedId) await CaseCannedReply.increment('used_count', { where: { id: cannedId } }).catch(() => undefined)

        await kase.reload()
        const people = await peopleLabels([kase.user_id, kase.assigned_to_user_id])
        return (res as any).success({ status: 201, data: { message: messageItem(comment), case: caseSummary(kase, people) } })
    }
}
