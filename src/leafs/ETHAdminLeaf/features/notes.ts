// ──────────────────────────────────────────────────────────────────────────
// Internal notes on records.
//
// Staff leave a word on a record ("called him, he'll send the papers Monday")
// and can pull a colleague in with a mention, written in the body as
// `@[Sara Ali](user:12)`: the text keeps the name it was written with, so a
// note still reads right after a rename, and the id is what gets notified.
//
// A note is as visible as its record: reading or writing one needs `show` on
// the collection, and only people who can see the collection can be
// mentioned, or a mention would leak a record to someone who may not open it.
// Only the author edits a note; the author or a super admin deletes it.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'
import { AdminNote } from '../models/AdminNote.js'
import { adminUserLabel, listAdminUsers, loadUsers, notifyAdmins, userIdOf } from './notifications.js'

export const MENTION = /@\[([^\]\n]{1,120})\]\(user:(\d+)\)/g
export const NOTE_MAX_LENGTH = 10000

export interface SerializedNote {
    id: number
    body: string
    mentions: number[]
    author: { id: number; name: string } | null
    created_at: Date
    updated_at: Date
    edited_at: Date | null
    can_edit: boolean
    can_delete: boolean
}

function adminLeaf(): any {
    return (etherial as any).eth_admin_leaf ?? null
}

/** The user ids a body mentions, in order, once each. */
export function parseMentions(body: string): number[] {
    const ids: number[] = []
    for (const match of String(body ?? '').matchAll(MENTION)) {
        const id = Number(match[2])
        if (Number.isInteger(id) && !ids.includes(id)) ids.push(id)
    }
    return ids
}

/** The body as an email or the bell shows it: `@Sara Ali` rather than the markup. */
export function plainNote(body: string): string {
    return String(body ?? '').replace(MENTION, (_all, name) => `@${name}`)
}

/** Whether this person may read and write notes on this collection's records. */
export async function canUseNotes(user: any, collection: string): Promise<boolean> {
    const leaf = adminLeaf()
    if (!leaf || !collection || !leaf.getCollection(collection)) return false
    const check = typeof leaf.canAccess === 'function' ? leaf.canAccess : leaf.checkAccess
    return !!(await check.call(leaf, user, collection, 'show'))
}

async function isSuperAdmin(user: any): Promise<boolean> {
    const leaf = adminLeaf()
    if (typeof leaf?.isSuperAdmin !== 'function') return false
    return !!(await leaf.isSuperAdmin(user))
}

/**
 * Staff who can see the collection, for the mention picker: matched on name
 * or email, at most `limit`, the asker left out.
 */
export async function mentionableUsers(collection: string, query: string, exceptId: number | null, limit = 10) {
    const q = String(query ?? '').trim().toLowerCase()
    const users = await listAdminUsers({ collection, permission: 'view' })
    const items: { id: number; name: string; email?: string }[] = []
    for (const user of users) {
        const id = userIdOf(user)
        if (id === null || id === exceptId) continue
        const name = adminUserLabel(user)
        const email = typeof user?.get === 'function' ? user.get('email') : user?.email
        if (q && !name.toLowerCase().includes(q) && !String(email ?? '').toLowerCase().includes(q)) continue
        items.push(email ? { id, name, email: String(email) } : { id, name })
        if (items.length >= limit) break
    }
    return items
}

/**
 * Keeps the mentions of people who can see the collection. Each one is
 * checked on its own rather than against the picker's list, so a mention
 * typed by hand is held to the same rule.
 */
async function allowedMentions(ids: number[], collection: string): Promise<number[]> {
    const leaf = adminLeaf()
    if (!ids.length || !leaf) return []
    const users = await loadUsers(ids)
    const allowed: number[] = []
    for (const id of ids) {
        const user = users.get(id)
        if (!user) continue
        if (!(await leaf.canAccessAdmin(user))) continue
        if (!(await canUseNotes(user, collection))) continue
        allowed.push(id)
    }
    return allowed
}

export async function serializeNotes(notes: AdminNote[], viewer: any): Promise<SerializedNote[]> {
    const viewerId = userIdOf(viewer)
    const superAdmin = await isSuperAdmin(viewer)
    const authors = await loadUsers(notes.map((note) => note.author_id))
    return notes.map((note) => {
        const author = authors.get(note.author_id)
        const own = viewerId !== null && note.author_id === viewerId
        return {
            id: note.id,
            body: note.body,
            mentions: Array.isArray(note.mentions) ? note.mentions : [],
            author: author ? { id: note.author_id, name: adminUserLabel(author) } : { id: note.author_id, name: `#${note.author_id}` },
            created_at: note.created_at,
            updated_at: note.updated_at,
            edited_at: note.edited_at ?? null,
            can_edit: own,
            can_delete: own || superAdmin,
        }
    })
}

export async function listNotes(collection: string, recordId: string): Promise<AdminNote[]> {
    return AdminNote.findAll({
        where: { collection, record_id: recordId } as any,
        order: [['id', 'ASC']],
        limit: 500,
    })
}

async function notifyMentions(note: AdminNote, ids: number[], author: any) {
    if (!ids.length) return
    const leaf = adminLeaf()
    const config = leaf?.getCollection(note.collection)
    const label = config?.meta?.label || note.collection
    const text = plainNote(note.body)
    await notifyAdmins({
        to: { userIds: ids },
        type: 'mention',
        title: `${adminUserLabel(author)} mentioned you on ${label} #${note.record_id}`,
        body: text.length > 280 ? `${text.slice(0, 277)}…` : text,
        link: `/${note.collection}/${encodeURIComponent(note.record_id)}`,
        collection: note.collection,
        recordId: note.record_id,
        actorId: userIdOf(author),
        data: { noteId: note.id },
        email: true,
    })
}

/** A failed notification must not lose the note that was just saved. */
function notifyQuietly(note: AdminNote, ids: number[], author: any) {
    notifyMentions(note, ids, author).catch((err: any) => console.error('[ETHAdminLeaf] Note mentions:', err?.message || err))
}

export async function createNote(collection: string, recordId: string, body: string, author: any): Promise<AdminNote> {
    const mentions = await allowedMentions(parseMentions(body), collection)
    const note = await AdminNote.create({
        collection,
        record_id: recordId,
        author_id: userIdOf(author),
        body,
        mentions,
    } as any)
    notifyQuietly(note, mentions, author)
    return note
}

/** Only the people mentioned for the first time hear about an edit. */
export async function updateNote(note: AdminNote, body: string, author: any): Promise<AdminNote> {
    const before = new Set(Array.isArray(note.mentions) ? note.mentions : [])
    const mentions = await allowedMentions(parseMentions(body), note.collection)
    await note.update({ body, mentions, edited_at: new Date() } as any)
    notifyQuietly(
        note,
        mentions.filter((id) => !before.has(id)),
        author
    )
    return note
}

export async function canDeleteNote(note: AdminNote, user: any): Promise<boolean> {
    if (note.author_id === userIdOf(user)) return true
    return isSuperAdmin(user)
}
