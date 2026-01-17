import etherial from 'etherial'
import { Controller, Get, ShouldFindAllFromModel, ShouldFindOneFromModel } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'
import { MessageLog } from '../../ETHPulseLeaf/models/MessageLog'

@Controller()
export default class ETHAdminMessageLogsController {
    @Get('/admin/messages/logs')
    @ShouldBeAuthenticated()
    @ShouldFindAllFromModel(MessageLog, {
        attributes: ['id', 'type', 'provider', 'recipient', 'subject', 'status', 'created_at'],
        allowedFilters: ['type', 'status', 'provider'],
        search: { fields: ['recipient', 'subject'] },
        defaultOrder: [['created_at', 'DESC']],
        canAccess: async (req: any) => {
            const adminLeaf = (etherial as any).eth_admin_leaf
            return adminLeaf?.checkAccess(req.user, 'messages', 'list') ?? false
        }
    })
    list() { }

    @Get('/admin/messages/logs/:id')
    @ShouldBeAuthenticated()
    @ShouldFindOneFromModel(MessageLog, {
        paramName: 'id',
        canAccess: async (req: any) => {
            const adminLeaf = (etherial as any).eth_admin_leaf
            return adminLeaf?.checkAccess(req.user, 'messages', 'show') ?? false
        }
    })
    show() { }
}

export const AvailableRouteMethods = ['list', 'show'] as const
