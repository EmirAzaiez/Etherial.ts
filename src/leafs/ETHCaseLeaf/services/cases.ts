import etherial from 'etherial'
import { Op } from 'sequelize'

import { CaseCannedReply } from '../models/CaseCannedReply.js'
import { attachmentFolders, caseModels, projectModel, customersOf, staffNameOf, type CaseDraft } from './options.js'
import { CaseStatus, FINISHED_STATUSES, type CaseAttachment } from './statuses.js'

// ──────────────────────────────────────────────────────────────────────────
// What can happen to a case, for the project's app routes and the leaf's
// back-office alike. The checks that answer the caller (is it theirs, is it
// still open) stay with the caller: each answers in its own words.
// ──────────────────────────────────────────────────────────────────────────

/** Opens a case. The hooks stamp its reference and start its clocks. */
export async function openCase(draft: CaseDraft, options: { transaction?: any } = {}): Promise<any> {
    const { Case } = caseModels()
    return Case.create({ channel: 'APP', ...draft }, options)
}

/**
 * Staff answer: a reply the customer is told of, or an internal note. With
 * `status`, the case moves in the same go; resolving or closing it tells the
 * customer once, not twice.
 */
export async function replyToCase(
    kase: any,
    message: { body: string; internal?: boolean; attachments?: CaseAttachment[]; author: any; status?: string | null },
): Promise<any> {
    const { CaseComment } = caseModels()
    const internal = !!message.internal
    const status = message.status && message.status !== kase.status ? message.status : null
    const comment = await CaseComment.create(
        {
            case_id: kase.id,
            author_kind: 'staff',
            author_user_id: message.author?.id ?? null,
            author_name: staffNameOf(message.author),
            body: message.body,
            internal,
            attachments: message.attachments ?? [],
        },
        { notify: !(status && FINISHED_STATUSES.includes(status as CaseStatus)) } as any,
    )
    if (status) {
        await kase.reload()
        await kase.update({ status })
    }
    return comment
}

/**
 * The customer says whether the resolution fixed it: closed, or back in
 * progress (`note` then says what is still wrong). Call it on a case that
 * `awaitsConfirmation`. The customer is not told of their own answer.
 */
export async function confirmResolution(kase: any, answer: { fixed: boolean; note?: string | null }): Promise<any> {
    const now = new Date()
    const values = answer.fixed
        ? { status: CaseStatus.CLOSED, confirmation_status: 'CONFIRMED', confirmation_note: answer.note || null, confirmation_at: now, last_activity_at: now }
        : {
              status: CaseStatus.IN_PROGRESS,
              confirmation_status: 'REJECTED',
              confirmation_note: answer.note,
              confirmation_at: now,
              reopened_count: (kase.reopened_count ?? 0) + 1,
              last_activity_at: now,
          }
    return kase.update(values, { notify: false } as any)
}

/** The customer's rating of a resolved or closed case. */
export async function rateCase(kase: any, rating: { rating: number; note?: string | null }): Promise<any> {
    return kase.update({ satisfaction_rating: rating.rating, satisfaction_note: rating.note || null }, { notify: false } as any)
}

/**
 * The files a staff member uploaded through the back-office (ETHMediaLeaf),
 * as a message's attachments: theirs, confirmed, in a case folder and public.
 * Throws on any other.
 */
export async function attachmentsFromMedia(staffId: number, mediaIds: unknown): Promise<CaseAttachment[]> {
    const ids = [...new Set((Array.isArray(mediaIds) ? mediaIds : []).map(Number))].filter((id) => Number.isInteger(id) && id > 0)
    if (!ids.length) return []
    const mediaLeaf = (etherial as any).eth_media_leaf
    const Media = projectModel('Media')
    if (!mediaLeaf || !Media) throw new Error('Files cannot be added: the media module is missing.')

    const rows = await Media.findAll({ where: { id: { [Op.in]: ids }, uploaded_by: staffId, status: 'uploaded', folder: { [Op.in]: attachmentFolders() } } })
    const byId = new Map<number, any>(rows.map((row: any) => [row.id, row]))
    return ids.map((id) => {
        const media = byId.get(id)
        const url = media ? mediaLeaf.getPublicUrl(media) : null
        if (!media || !url) throw new Error('A file is missing or not uploaded yet. Add it again.')
        return { id: media.id, url, filename: media.real_name ?? null, content_type: media.mime_type ?? null }
    })
}

/** A canned reply's text for this case: `{{customer_name}}`, `{{reference}}`, `{{subject}}`, `{{staff_name}}`. */
export function renderCannedReply(body: string, kase: any, customer: any, staff: any): string {
    const first = (user: any) => String(user?.first_name ?? user?.firstname ?? '').trim()
    const values: Record<string, string> = {
        customer_name: first(customer),
        reference: kase.reference ?? '',
        subject: kase.subject ?? '',
        staff_name: staffNameOf(staff),
    }
    return body
        .replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => (key in values ? values[key] : match))
        .replace(/[ \t]+([,.!?])/g, '$1')
}

/** The active canned replies for a case of this kind, most used first. */
export async function cannedRepliesFor(kase: any, staff: any): Promise<{ id: number; title: string; body: string }[]> {
    const rows = await CaseCannedReply.findAll({
        where: { active: true, [Op.or]: [{ kind: null }, { kind: kase.kind }] },
        order: [
            ['used_count', 'DESC'],
            ['title', 'ASC'],
        ],
        limit: 100,
    })
    const customer = kase.user_id ? await projectModel(customersOf().model)?.findByPk(kase.user_id) : null
    return rows.map((row: any) => ({ id: row.id, title: row.title, body: renderCannedReply(row.body, kase, customer, staff) }))
}

/** The Media ids the cases and their messages keep in JSON, for ETHMediaLeaf's orphan cleanup. */
export async function caseMediaIds(): Promise<number[]> {
    const { Case, CaseComment } = caseModels()
    const ids: number[] = []
    const add = (list: unknown) => {
        for (const file of Array.isArray(list) ? list : []) if (file && typeof file === 'object' && Number.isInteger((file as any).id)) ids.push((file as any).id)
    }
    for (const row of await Case.findAll({ attributes: ['attachments', 'issues'], raw: true })) {
        add(row.attachments)
        for (const issue of Array.isArray(row.issues) ? row.issues : []) add(issue?.photos)
    }
    for (const row of await CaseComment.findAll({ attributes: ['attachments'], raw: true })) add(row.attachments)
    return ids
}
