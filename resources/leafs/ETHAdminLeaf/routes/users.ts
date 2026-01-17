import etherial from 'etherial'
import { Controller, Get, ShouldFindAllFromModel } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'
import { User } from '../../ETHUserLeaf/models/User'

@Controller()
export default class ETHAdminUsersController {
    @Get('/admin/users')
    @ShouldBeAuthenticated()
    @ShouldFindAllFromModel(User, {
        attributes: ['id', 'email', 'firstname', 'lastname', 'role', 'created_at'],
        allowedFilters: ['role'],
        search: { fields: ['email', 'firstname', 'lastname'] },
        defaultOrder: [['created_at', 'DESC']],
        canAccess: async (req: any) => {
            const adminLeaf = (etherial as any).eth_admin_leaf
            return adminLeaf?.checkAccess(req.user, 'users', 'list') ?? false
        }
    })
    list() { }
}

export const AvailableRouteMethods = ['list'] as const
