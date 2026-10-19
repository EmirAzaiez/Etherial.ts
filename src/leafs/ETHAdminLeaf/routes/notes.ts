import etherial from 'etherial'
import type { Request, Response } from 'express'
import { Controller, Get, Post, Put, Delete } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { AdminNote } from '../models/AdminNote.js'
import { userIdOf } from '../features/notifications.js'
import {
    NOTE_MAX_LENGTH,
    canDeleteNote,
    canUseNotes,
    createNote,
    listNotes,
    mentionableUsers,
    serializeNotes,
    updateNote,
} from '../features/notes.js'

const getAdminLeaf = () => (etherial as any).eth_admin_leaf

/** The body as sent, or the error code it earns. */
function bodyOf(req: Request): { body: string } | { error: string } {
    const raw = (req.body as any)?.body
    if (typeof raw !== 'string' || !raw.trim()) return { error: 'body_required' }
    if (raw.length > NOTE_MAX_LENGTH) return { error: 'body_too_long' }
    return { body: raw.trim() }
}

@Controller()
export default class ETHAdminNotesController {
    /**
     * GET /admin/notes/mentionable?collection=orders&q=sa
     *
     * Who can be mentioned on this collection's records: staff who may see it.
     */
    @Get('/admin/notes/mentionable')
    @ShouldBeAuthenticated()
    async mentionable(req: Request & { user: any }, res: Response): Promise<any> {
        const collection = String(req.query.collection ?? '')
        if (!(await canUseNotes(req.user, collection))) {
            return (res as any).error({ status: 403, errors: ['forbidden'] })
        }
        const items = await mentionableUsers(collection, String(req.query.q ?? ''), userIdOf(req.user))
        return (res as any).success({ status: 200, data: { items } })
    }

    /** GET /admin/notes/:collection/:id: the record's notes, oldest first. */
    @Get('/admin/notes/:collection/:id')
    @ShouldBeAuthenticated()
    async list(req: Request & { user: any }, res: Response): Promise<any> {
        const { collection, id } = req.params
        if (!(await canUseNotes(req.user, collection))) {
            return (res as any).error({ status: 403, errors: ['forbidden'] })
        }
        const notes = await listNotes(collection, String(id))
        return (res as any).success({ status: 200, data: { items: await serializeNotes(notes, req.user) } })
    }

    /** POST /admin/notes/:collection/:id  body `{ body }` */
    @Post('/admin/notes/:collection/:id')
    @ShouldBeAuthenticated()
    async create(req: Request & { user: any }, res: Response): Promise<any> {
        const { collection, id } = req.params
        if (!(await canUseNotes(req.user, collection))) {
            return (res as any).error({ status: 403, errors: ['forbidden'] })
        }
        if (userIdOf(req.user) === null) {
            return (res as any).error({ status: 403, errors: ['forbidden'] })
        }
        const parsed = bodyOf(req)
        if ('error' in parsed) {
            return (res as any).error({ status: 400, errors: [parsed.error] })
        }

        // A note on a record that does not exist would never be seen again.
        const model = getAdminLeaf()?.getCollection(collection)?.model
        if (model && !(await model.findByPk(id))) {
            return (res as any).error({ status: 404, errors: ['not_found'] })
        }

        const note = await createNote(collection, String(id), parsed.body, req.user)
        const [item] = await serializeNotes([note], req.user)
        return (res as any).success({ status: 201, data: item })
    }

    /** PUT /admin/notes/item/:noteId  body `{ body }`: the author only. */
    @Put('/admin/notes/item/:noteId')
    @ShouldBeAuthenticated()
    async update(req: Request & { user: any }, res: Response): Promise<any> {
        const note = await AdminNote.findByPk(Number(req.params.noteId) || 0)
        if (!note || !(await canUseNotes(req.user, note.collection))) {
            return (res as any).error({ status: 404, errors: ['not_found'] })
        }
        if (note.author_id !== userIdOf(req.user)) {
            return (res as any).error({ status: 403, errors: ['not_author'] })
        }
        const parsed = bodyOf(req)
        if ('error' in parsed) {
            return (res as any).error({ status: 400, errors: [parsed.error] })
        }

        await updateNote(note, parsed.body, req.user)
        const [item] = await serializeNotes([note], req.user)
        return (res as any).success({ status: 200, data: item })
    }

    /** DELETE /admin/notes/item/:noteId: the author, or a super admin. */
    @Delete('/admin/notes/item/:noteId')
    @ShouldBeAuthenticated()
    async remove(req: Request & { user: any }, res: Response): Promise<any> {
        const note = await AdminNote.findByPk(Number(req.params.noteId) || 0)
        if (!note || !(await canUseNotes(req.user, note.collection))) {
            return (res as any).error({ status: 404, errors: ['not_found'] })
        }
        if (!(await canDeleteNote(note, req.user))) {
            return (res as any).error({ status: 403, errors: ['forbidden'] })
        }
        await note.destroy()
        return (res as any).success({ status: 200, data: { id: note.id } })
    }
}
