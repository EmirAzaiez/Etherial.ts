import etherial from 'etherial'
import type { Request, Response } from 'express'
import { UniqueConstraintError } from 'sequelize'
import { Controller, Delete, Get, Put } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'

import { AdminPreference } from '../models/AdminPreference.js'

const getAdminLeaf = () => (etherial as any).eth_admin_leaf

/** A key the back-office names: `favorites`, `hiddenColumns`… never a path, never free text. */
const KEY = /^[A-Za-z0-9_.:-]{1,64}$/

/** Saved views and hidden columns for every list fit far below this; anything bigger is not a preference. */
const MAX_VALUE_BYTES = 64 * 1024

/** Keys one user may keep: the back-office uses a handful, the cap only stops a runaway client. */
const MAX_KEYS = 100

/** The signed-in user's id, only for someone who may open the back-office. */
async function ownerOf(req: Request & { user: any }, res: Response): Promise<number | null> {
    const adminLeaf = getAdminLeaf()
    const userId = Number(req.user?.id)
    if (!adminLeaf || !Number.isInteger(userId) || !(await adminLeaf.canAccessAdmin(req.user))) {
        (res as any).error?.({ status: 403, errors: ['forbidden'] })
        return null
    }
    return userId
}

@Controller()
export default class ETHAdminPrefsController {
    /**
     * GET /admin/prefs → `{ [key]: value }`
     *
     * The signed-in user's back-office preferences, and only theirs: the user
     * comes from the token, never from the request.
     */
    @Get('/admin/prefs')
    @ShouldBeAuthenticated()
    async list(req: Request & { user: any }, res: Response): Promise<any> {
        const userId = await ownerOf(req, res)
        if (userId === null) {
            return
        }
        const rows = await AdminPreference.findAll({ where: { user_id: userId }, attributes: ['key', 'value'] })
        return (res as any).success?.({
            status: 200,
            data: Object.fromEntries(rows.map((row) => [row.key, row.value])),
        })
    }

    /** PUT /admin/prefs/:key, body `{ value }`: one preference, created or replaced. */
    @Put('/admin/prefs/:key')
    @ShouldBeAuthenticated()
    async put(req: Request & { user: any }, res: Response): Promise<any> {
        const userId = await ownerOf(req, res)
        if (userId === null) {
            return
        }
        const key = req.params.key
        if (!KEY.test(key)) {
            return (res as any).error?.({ status: 400, errors: ['invalid_key'] })
        }
        if (!req.body || typeof req.body !== 'object' || !('value' in req.body)) {
            return (res as any).error?.({ status: 400, errors: ['value_required'] })
        }
        const value = req.body.value ?? null
        const size = Buffer.byteLength(JSON.stringify(value) ?? 'null', 'utf8')
        if (size > MAX_VALUE_BYTES) {
            return (res as any).error?.({ status: 413, errors: ['value_too_large'] })
        }

        const where = { user_id: userId, key }
        const existing = await AdminPreference.findOne({ where })
        if (existing) {
            await existing.update({ value })
            return (res as any).success?.({ status: 200, data: { key, value } })
        }

        if ((await AdminPreference.count({ where: { user_id: userId } })) >= MAX_KEYS) {
            return (res as any).error?.({ status: 400, errors: ['too_many_keys'] })
        }
        try {
            await AdminPreference.create({ ...where, value } as any)
        } catch (err) {
            // Two tabs saving the same new key at once: the other one created
            // the row a moment ago, so this write replaces it.
            if (!(err instanceof UniqueConstraintError)) {
                throw err
            }
            await AdminPreference.update({ value } as any, { where })
        }
        return (res as any).success?.({ status: 200, data: { key, value } })
    }

    /** DELETE /admin/prefs/:key: back to the back-office's default. */
    @Delete('/admin/prefs/:key')
    @ShouldBeAuthenticated()
    async remove(req: Request & { user: any }, res: Response): Promise<any> {
        const userId = await ownerOf(req, res)
        if (userId === null) {
            return
        }
        const key = req.params.key
        if (!KEY.test(key)) {
            return (res as any).error?.({ status: 400, errors: ['invalid_key'] })
        }
        await AdminPreference.destroy({ where: { user_id: userId, key } })
        return (res as any).success?.({ status: 200, data: { key } })
    }
}

export const AvailableRouteMethods = ['list', 'put', 'remove'] as const
