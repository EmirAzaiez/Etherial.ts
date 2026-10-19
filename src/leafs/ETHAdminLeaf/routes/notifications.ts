import etherial from 'etherial'
import type { Request, Response } from 'express'
import { Controller, Get, Post } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { AdminNotification } from '../models/AdminNotification.js'
import { adminUserLabel, loadUsers, userIdOf } from '../features/notifications.js'

const getAdminLeaf = () => (etherial as any).eth_admin_leaf

/**
 * The signed-in person, if they may open the back-office. Every route below
 * reads and writes only that person's rows: there is no way to name another
 * user's inbox.
 */
async function inboxOwner(req: Request & { user: any }): Promise<number | null> {
    const adminLeaf = getAdminLeaf()
    if (!adminLeaf || !(await adminLeaf.canAccessAdmin(req.user))) return null
    return userIdOf(req.user)
}

const unreadOf = (userId: number) => AdminNotification.count({ where: { user_id: userId, read_at: null } as any })

@Controller()
export default class ETHAdminNotificationsController {
    /**
     * GET /admin/notifications?unread=1&page=1&limit=20
     *
     * The person's notifications, newest first, each with who caused it.
     */
    @Get('/admin/notifications')
    @ShouldBeAuthenticated()
    async list(req: Request & { user: any }, res: Response): Promise<any> {
        const userId = await inboxOwner(req)
        if (userId === null) {
            return (res as any).error({ status: 403, errors: ['forbidden'] })
        }

        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100)
        const page = Math.max(Number(req.query.page) || 1, 1)
        const unreadOnly = req.query.unread === '1' || req.query.unread === 'true'
        const where: any = { user_id: userId }
        if (unreadOnly) where.read_at = null

        const [{ rows, count }, unread] = await Promise.all([
            AdminNotification.findAndCountAll({ where, order: [['id', 'DESC']], limit, offset: (page - 1) * limit }),
            unreadOf(userId),
        ])
        const actors = await loadUsers(rows.map((row) => row.actor_id).filter((id): id is number => id !== null))

        const items = rows.map((row) => {
            const actor = row.actor_id !== null ? actors.get(row.actor_id) : null
            return {
                id: row.id,
                type: row.type,
                title: row.title,
                body: row.body,
                link: row.link,
                collection: row.collection,
                record_id: row.record_id,
                data: row.data,
                read_at: row.read_at,
                created_at: row.created_at,
                actor: actor ? { id: row.actor_id, name: adminUserLabel(actor) } : null,
            }
        })
        return (res as any).success({ status: 200, data: { items, total: count, unread } })
    }

    /** GET /admin/notifications/unread-count: what the bell polls. */
    @Get('/admin/notifications/unread-count')
    @ShouldBeAuthenticated()
    async unreadCount(req: Request & { user: any }, res: Response): Promise<any> {
        const userId = await inboxOwner(req)
        if (userId === null) {
            return (res as any).error({ status: 403, errors: ['forbidden'] })
        }
        return (res as any).success({ status: 200, data: { unread: await unreadOf(userId) } })
    }

    /** POST /admin/notifications/:id/read */
    @Post('/admin/notifications/:id/read')
    @ShouldBeAuthenticated()
    async markRead(req: Request & { user: any }, res: Response): Promise<any> {
        const userId = await inboxOwner(req)
        if (userId === null) {
            return (res as any).error({ status: 403, errors: ['forbidden'] })
        }
        const id = Number(req.params.id)
        if (!Number.isInteger(id) || id <= 0) {
            return (res as any).error({ status: 400, errors: ['invalid_id'] })
        }

        // Scoped to the owner: someone else's id is simply not found.
        const row = await AdminNotification.findOne({ where: { id, user_id: userId } as any })
        if (!row) {
            return (res as any).error({ status: 404, errors: ['not_found'] })
        }
        if (!row.read_at) await row.update({ read_at: new Date() } as any)
        return (res as any).success({ status: 200, data: { id, read_at: row.read_at, unread: await unreadOf(userId) } })
    }

    /** POST /admin/notifications/read-all */
    @Post('/admin/notifications/read-all')
    @ShouldBeAuthenticated()
    async markAllRead(req: Request & { user: any }, res: Response): Promise<any> {
        const userId = await inboxOwner(req)
        if (userId === null) {
            return (res as any).error({ status: 403, errors: ['forbidden'] })
        }
        const [updated] = await AdminNotification.update({ read_at: new Date() } as any, {
            where: { user_id: userId, read_at: null } as any,
        })
        return (res as any).success({ status: 200, data: { updated, unread: 0 } })
    }
}
