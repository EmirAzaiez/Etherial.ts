import { Controller, Get, Request, Response } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'
import etherial from 'etherial'

import { communicationsOptions, userCommunications } from '../services/communications.js'

const getAdminLeaf = () => (etherial as any).eth_admin_leaf
const getPulseLeaf = () => (etherial as any).eth_pulse_leaf

@Controller()
export default class ETHPulseCommunicationsController {
    /**
     * GET /admin/pulse/users/:id/communications?before=ISO&limit=30&channel=push
     *
     * Everything the user was sent, newest first, and their devices. Whoever
     * may open the user's record may read it.
     */
    @Get('/admin/pulse/users/:id/communications')
    @ShouldBeAuthenticated()
    public async userCommunications(req: Request & { user: any }, res: Response): Promise<any> {
        const config = communicationsOptions(getPulseLeaf()?.config?.communications)
        if (!config) {
            return (res as any).error({ status: 404, errors: ['Not found'] })
        }

        const adminLeaf = getAdminLeaf()
        const collection = config.usersCollection ?? 'users'
        if (!adminLeaf || !(await adminLeaf.checkAccess(req.user, collection, 'show'))) {
            return (res as any).error({ status: 403, errors: ['Forbidden'] })
        }

        const userId = Number(req.params.id)
        if (!Number.isInteger(userId) || userId <= 0) {
            return (res as any).error({ status: 400, errors: ['Invalid user id'] })
        }

        const before = typeof req.query.before === 'string' ? new Date(req.query.before) : undefined
        if (before && Number.isNaN(before.getTime())) {
            return (res as any).error({ status: 400, errors: ['Invalid cursor'] })
        }

        const result = await userCommunications({
            userId,
            before,
            limit: Number(req.query.limit) || undefined,
            channel: typeof req.query.channel === 'string' && req.query.channel ? req.query.channel : undefined,
            config,
        })
        if (!result) {
            return (res as any).error({ status: 404, errors: ['User not found'] })
        }

        return (res as any).success({ status: 200, data: result })
    }
}
