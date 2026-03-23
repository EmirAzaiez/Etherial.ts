import etherial from 'etherial'
import { Request, Response } from 'etherial/components/http/provider'
import { Controller, Get } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'
import { Reactive } from 'etherial/components/reactive/index'

const getAdminLeaf = () => (etherial as any).eth_admin_leaf
const getReactive = (): Reactive | null => {
    // Try different possible module names
    const reactive = (etherial as any).reactive || (etherial as any)['reactive']
    if (!reactive) {
        console.log('[ReactiveController] Available etherial modules:', Object.keys(etherial))
    }
    return reactive
}

interface ConnectedUserInfo {
    socketId: string
    userId?: string | number
    user?: {
        id: number
        first_name: string | null
        last_name: string | null
        email: string | null
        phone_number: string | null
        role: number
    } | null
    rooms: string[]
    connectedAt: Date
    lastActivity: Date
    isAuthenticated: boolean
}

@Controller()
export default class ReactiveController {
    /**
     * Debug endpoint to check reactive module status
     */
    @Get('/admin/reactive/debug')
    @ShouldBeAuthenticated()
    async debug(req: Request & { user: any }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()

        const hasAccess = await adminLeaf?.canAccessAdmin(req.user)
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        const reactive = getReactive()
        const modules = Object.keys(etherial)

        // Get more details from Socket.io
        let ioDetails: any = null
        if (reactive?.io) {
            const io = reactive.io
            const adapter = io.sockets?.adapter
            ioDetails = {
                engineClientsCount: io.engine?.clientsCount ?? 0,
                socketsSize: io.sockets?.sockets?.size ?? 0,
                rooms: adapter?.rooms ? Array.from(adapter.rooms.keys()) : [],
                roomsSizes: {} as Record<string, number>,
            }
            // Get size of each room
            if (adapter?.rooms) {
                for (const [roomName, sockets] of adapter.rooms) {
                    ioDetails.roomsSizes[roomName] = sockets.size
                }
            }
        }

        // Get connectedSockets from reactive
        const connectedSockets = reactive?.getConnectedSockets?.()
        const connectedSocketsInfo = connectedSockets
            ? {
                  size: connectedSockets.size,
                  sockets: Array.from(connectedSockets.entries()).map(([id, info]) => ({
                      socketId: id,
                      userId: info.userId,
                      rooms: Array.from(info.rooms),
                      connectedAt: info.connectedAt,
                      lastActivity: info.lastActivity,
                  })),
              }
            : null

        return (res as any).success?.({
            status: 200,
            data: {
                availableModules: modules,
                reactiveFound: !!reactive,
                reactiveType: reactive ? typeof reactive : null,
                reactiveHasIo: reactive?.io ? true : false,
                ioDetails,
                connectedSockets: connectedSocketsInfo,
                reactiveMethods: reactive ? Object.getOwnPropertyNames(Object.getPrototypeOf(reactive)).filter((m) => m !== 'constructor') : [],
            },
        })
    }

    /**
     * Get real-time statistics for reactive connections
     * Returns counts for total, guests, and authenticated users
     */
    @Get('/admin/reactive/stats')
    @ShouldBeAuthenticated()
    async getStats(req: Request & { user: any }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()
        const reactive = getReactive()

        // Check if user has access to admin
        const hasAccess = await adminLeaf?.canAccessAdmin(req.user)
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        if (!reactive) {
            return (res as any).error?.({
                status: 500,
                errors: ['reactive_not_initialized'],
                debug: { availableModules: Object.keys(etherial) },
            })
        }

        const stats = {
            total: reactive.getConnectionCount(),
            guests: reactive.getRoomSize('guests'),
            authenticated: reactive.getRoomSize('users'),
            uniqueUsers: reactive.getAuthenticatedUserCount(),
            rooms: {
                all: reactive.getRoomSize('all'),
                guests: reactive.getRoomSize('guests'),
                users: reactive.getRoomSize('users'),
            },
        }

        return (res as any).success?.({
            status: 200,
            data: stats,
        })
    }

    /**
     * Get all connected sockets with details
     * Returns list of all connections (guests + authenticated)
     */
    @Get('/admin/reactive/connections')
    @ShouldBeAuthenticated()
    async getConnections(req: Request & { user: any }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()
        const reactive = getReactive()

        // Check if user has access to admin
        const hasAccess = await adminLeaf?.canAccessAdmin(req.user)
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        if (!reactive) {
            return (res as any).error?.({ status: 500, errors: ['reactive_not_initialized'] })
        }

        const connectedSockets = reactive.getConnectedSockets()
        const connections = await this.enrichConnections(connectedSockets)

        return (res as any).success?.({
            status: 200,
            data: {
                total: connections.length,
                connections,
            },
        })
    }

    /**
     * Get authenticated users only
     * Returns list of all authenticated user connections
     */
    @Get('/admin/reactive/users')
    @ShouldBeAuthenticated()
    async getAuthenticatedUsers(req: Request & { user: any }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()
        const reactive = getReactive()

        // Check if user has access to admin
        const hasAccess = await adminLeaf?.canAccessAdmin(req.user)
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        if (!reactive) {
            return (res as any).error?.({ status: 500, errors: ['reactive_not_initialized'] })
        }

        const connectedSockets = reactive.getConnectedSockets()
        const allConnections = await this.enrichConnections(connectedSockets)

        // Filter only authenticated users
        const authenticatedConnections = allConnections.filter((c) => c.isAuthenticated)

        // Group by userId to show unique users with their socket count
        const userMap = new Map<
            string | number,
            {
                user: ConnectedUserInfo['user']
                sockets: Array<{
                    socketId: string
                    connectedAt: Date
                    lastActivity: Date
                    rooms: string[]
                }>
            }
        >()

        for (const conn of authenticatedConnections) {
            if (conn.userId) {
                const existing = userMap.get(conn.userId)
                if (existing) {
                    existing.sockets.push({
                        socketId: conn.socketId,
                        connectedAt: conn.connectedAt,
                        lastActivity: conn.lastActivity,
                        rooms: conn.rooms,
                    })
                } else {
                    userMap.set(conn.userId, {
                        user: conn.user,
                        sockets: [
                            {
                                socketId: conn.socketId,
                                connectedAt: conn.connectedAt,
                                lastActivity: conn.lastActivity,
                                rooms: conn.rooms,
                            },
                        ],
                    })
                }
            }
        }

        const users = Array.from(userMap.entries()).map(([userId, data]) => ({
            userId,
            user: data.user,
            socketCount: data.sockets.length,
            sockets: data.sockets,
        }))

        return (res as any).success?.({
            status: 200,
            data: {
                uniqueUsers: users.length,
                totalSockets: authenticatedConnections.length,
                users,
            },
        })
    }

    /**
     * Get guest connections only
     * Returns list of all unauthenticated connections
     */
    @Get('/admin/reactive/guests')
    @ShouldBeAuthenticated()
    async getGuests(req: Request & { user: any }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()
        const reactive = getReactive()

        // Check if user has access to admin
        const hasAccess = await adminLeaf?.canAccessAdmin(req.user)
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        if (!reactive) {
            return (res as any).error?.({ status: 500, errors: ['reactive_not_initialized'] })
        }

        const connectedSockets = reactive.getConnectedSockets()
        const allConnections = await this.enrichConnections(connectedSockets)

        // Filter only guests (non-authenticated)
        const guestConnections = allConnections.filter((c) => !c.isAuthenticated)

        return (res as any).success?.({
            status: 200,
            data: {
                total: guestConnections.length,
                guests: guestConnections.map((g) => ({
                    socketId: g.socketId,
                    rooms: g.rooms,
                    connectedAt: g.connectedAt,
                    lastActivity: g.lastActivity,
                })),
            },
        })
    }

    /**
     * Check if a specific user is online
     */
    @Get('/admin/reactive/users/:userId/status')
    @ShouldBeAuthenticated()
    async getUserStatus(req: Request & { user: any; params: { userId: string } }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()
        const reactive = getReactive()

        // Check if user has access to admin
        const hasAccess = await adminLeaf?.canAccessAdmin(req.user)
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        if (!reactive) {
            return (res as any).error?.({ status: 500, errors: ['reactive_not_initialized'] })
        }

        const userId = parseInt(req.params.userId)
        const isOnline = reactive.isUserOnline(userId)

        // Get user sockets if online
        let sockets: any[] = []
        if (isOnline) {
            const connectedSockets = reactive.getConnectedSockets()
            for (const [, info] of connectedSockets) {
                if (info.userId === userId) {
                    sockets.push({
                        socketId: info.socketId,
                        rooms: Array.from(info.rooms),
                        connectedAt: info.connectedAt,
                        lastActivity: info.lastActivity,
                    })
                }
            }
        }

        return (res as any).success?.({
            status: 200,
            data: {
                userId,
                isOnline,
                socketCount: sockets.length,
                sockets,
            },
        })
    }

    /**
     * Enrich socket connections with user data from database
     */
    private async enrichConnections(
        connectedSockets: Map<
            string,
            {
                socketId: string
                userId?: string | number
                rooms: Set<string>
                connectedAt: Date
                lastActivity: Date
            }
        >,
    ): Promise<ConnectedUserInfo[]> {
        const connections: ConnectedUserInfo[] = []
        const userIds = new Set<number>()

        // Collect user IDs
        for (const [, info] of connectedSockets) {
            if (info.userId) {
                userIds.add(Number(info.userId))
            }
        }

        // Fetch user data from database
        let usersMap = new Map<number, any>()
        if (userIds.size > 0) {
            try {
                const User = etherial.database.sequelize.models.User
                const rawAttrs = Object.keys(User.rawAttributes || {})

                const pick = (options: string[]) => options.find((attr) => rawAttrs.includes(attr))

                const attributes = [
                    'id',
                    pick(['first_name', 'firstname']),
                    pick(['last_name', 'lastname']),
                    pick(['email']),
                    pick(['phone_number', 'phone']),
                    pick(['role']),
                ].filter(Boolean) as string[]

                const users = await User.findAll({
                    where: { id: Array.from(userIds) },
                    attributes,
                })
                for (const user of users) {
                    usersMap.set(user.id, user.toJSON())
                }
            } catch (error) {
                console.error('[ReactiveController] Error fetching users:', error)
            }
        }

        // Build connections list
        for (const [, info] of connectedSockets) {
            const isAuthenticated = info.userId !== undefined
            connections.push({
                socketId: info.socketId,
                userId: info.userId,
                user: info.userId ? usersMap.get(Number(info.userId)) || null : null,
                rooms: Array.from(info.rooms),
                connectedAt: info.connectedAt,
                lastActivity: info.lastActivity,
                isAuthenticated,
            })
        }

        return connections
    }
}

export const AvailableRouteMethods = ['debug', 'getStats', 'getConnections', 'getAuthenticatedUsers', 'getGuests', 'getUserStatus'] as const
