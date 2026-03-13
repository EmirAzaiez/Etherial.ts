import { Server, Socket } from 'socket.io'
import etherial from '../../index.js'
import { IEtherialModule } from '../../index.js'

interface ReactiveListener {
    event: string
    callback: (data: any, socket: Socket) => void | Promise<void>
}

interface SocketMiddleware {
    (socket: Socket, next: (err?: Error) => void): void
}

export interface ReactiveConfig {
    cors?: {
        origin: string | string[]
        methods?: string[]
        credentials?: boolean
    }
    pingInterval?: number
    pingTimeout?: number
    maxHttpBufferSize?: number
}

interface ConnectedUser {
    socketId: string
    deviceId?: string
    userId?: string | number
    rooms: Set<string>
    connectedAt: Date
    lastActivity: Date
}

export class Reactive implements IEtherialModule {
    io: Server | null = null
    private config: ReactiveConfig
    private connectedSockets: Map<string, ConnectedUser> = new Map()
    private deviceToSocket: Map<string, Set<string>> = new Map() // deviceId -> socketIds
    private middlewares: SocketMiddleware[] = []
    private globalListeners: ReactiveListener[] = []

    constructor(config: ReactiveConfig = {}) {
        this.config = config
    }

    /**
     * Add middleware to be executed on each socket connection
     */
    useMiddleware(middleware: SocketMiddleware): this {
        this.middlewares.push(middleware)
        return this
    }

    /**
     * Add global listener for all sockets
     */
    on(event: string, callback: (data: any, socket: Socket) => void | Promise<void>): this {
        this.globalListeners.push({ event, callback })
        return this
    }

    /**
     * Start listening for socket connections
     */
    listen(listeners: ReactiveListener[] = []): Promise<boolean> {
        return new Promise((resolve) => {
            const httpServer = etherial['http']?.server
            if (!httpServer) {
                console.error('[Reactive] HTTP server not found. Make sure to initialize http module first.')
                resolve(false)
                return
            }

            this.io = new Server(httpServer, {
                cors: this.config.cors ?? {
                    origin: '*',
                    methods: ['PUT', 'GET', 'POST', 'DELETE', 'OPTIONS'],
                    credentials: false,
                },
                pingInterval: this.config.pingInterval ?? 25000,
                pingTimeout: this.config.pingTimeout ?? 20000,
                maxHttpBufferSize: this.config.maxHttpBufferSize ?? 1e6,
            })

            // Apply middlewares
            for (const middleware of this.middlewares) {
                this.io.use(middleware)
            }

            this.io.on('connection', (socket) => {
                this.handleConnection(socket, [...listeners, ...this.globalListeners])
            })

            console.log('[Reactive] Socket.io server initialized')
            resolve(true)
        })
    }

    /**
     * Handle new socket connection
     */
    private handleConnection(socket: Socket, listeners: ReactiveListener[]): void {
        // Extract device_id from handshake auth
        const deviceId = socket.handshake.auth?.device_id as string | undefined

        // Track socket
        this.connectedSockets.set(socket.id, {
            socketId: socket.id,
            deviceId,
            rooms: new Set(['all', 'guests']),
            connectedAt: new Date(),
            lastActivity: new Date(),
        })

        // Track device -> socket mapping
        if (deviceId) {
            if (!this.deviceToSocket.has(deviceId)) {
                this.deviceToSocket.set(deviceId, new Set())
            }
            this.deviceToSocket.get(deviceId)!.add(socket.id)
            socket.join(`device_${deviceId}`)
        }

        // Join default rooms
        socket.join('all')
        socket.join('guests')

        // Setup handlers
        this.setupAuthHandlers(socket)
        this.setupListeners(socket, listeners)
        this.setupDisconnectHandler(socket)
        this.setupActivityTracking(socket)

        // Emit connection event
        socket.emit('connected', {
            socketId: socket.id,
            deviceId: deviceId ?? null,
            timestamp: Date.now(),
        })
    }

    /**
     * Setup authentication handlers
     */
    private setupAuthHandlers(socket: Socket): void {
        const httpAuth = etherial['http_auth']

        socket.on('auth', async (token: string, callback?: (result: { success: boolean; error?: string }) => void) => {
            if (!httpAuth) {
                callback?.({ success: false, error: 'Auth module not available' })
                return
            }

            try {
                const payload = httpAuth.verifyToken(token)
                if (!payload) {
                    callback?.({ success: false, error: 'Invalid token' })
                    return
                }

                const userId = payload.id || payload.user_id
                const userRoom = `user_${userId}`

                // Update tracking
                const socketInfo = this.connectedSockets.get(socket.id)
                if (socketInfo) {
                    socketInfo.userId = userId
                    socketInfo.rooms.delete('guests')
                    socketInfo.rooms.add('users')
                    socketInfo.rooms.add(userRoom)
                }

                // Update rooms
                await socket.leave('guests')
                socket.join('users')
                socket.join(userRoom)

                // If device_id is present, join user-device specific room
                // This allows targeting: all user sockets OR specific user+device
                if (socketInfo?.deviceId) {
                    socket.join(`user_${userId}_device_${socketInfo.deviceId}`)
                }

                callback?.({ success: true })
                socket.emit('authenticated', {
                    userId,
                    deviceId: socketInfo?.deviceId ?? null,
                    socketId: socket.id,
                })

            } catch (error) {
                callback?.({ success: false, error: 'Authentication failed' })
            }
        })

        socket.on('deauth', async (callback?: (result: { success: boolean }) => void) => {
            await this.deauthenticateSocket(socket)
            callback?.({ success: true })
        })
    }

    /**
     * Deauthenticate a socket
     */
    private async deauthenticateSocket(socket: Socket): Promise<void> {
        const socketInfo = this.connectedSockets.get(socket.id)

        // Leave all rooms except socket.id and 'all'
        const rooms = Array.from(socket.rooms)
        const leavePromises = rooms
            .filter(room => room !== socket.id && room !== 'all')
            .map(room => socket.leave(room))

        await Promise.all(leavePromises)

        // Reset to guest
        socket.join('guests')

        // Update tracking
        if (socketInfo) {
            socketInfo.userId = undefined
            socketInfo.rooms = new Set(['all', 'guests'])
        }

        socket.emit('deauthenticated')
    }

    /**
     * Setup custom event listeners
     */
    private setupListeners(socket: Socket, listeners: ReactiveListener[]): void {
        for (const listener of listeners) {
            socket.on(listener.event, async (data) => {
                // Update activity
                const socketInfo = this.connectedSockets.get(socket.id)
                if (socketInfo) {
                    socketInfo.lastActivity = new Date()
                }

                try {
                    await listener.callback(data, socket)
                } catch (error) {
                    console.error(`[Reactive] Error in listener "${listener.event}":`, error)
                    socket.emit('error', {
                        event: listener.event,
                        message: 'An error occurred processing your request',
                    })
                }
            })
        }
    }

    /**
     * Setup disconnect handler
     */
    private setupDisconnectHandler(socket: Socket): void {
        socket.on('disconnect', (reason) => {
            // Clean up device tracking
            const socketInfo = this.connectedSockets.get(socket.id)
            if (socketInfo?.deviceId) {
                const deviceSockets = this.deviceToSocket.get(socketInfo.deviceId)
                if (deviceSockets) {
                    deviceSockets.delete(socket.id)
                    if (deviceSockets.size === 0) {
                        this.deviceToSocket.delete(socketInfo.deviceId)
                    }
                }
            }

            this.connectedSockets.delete(socket.id)

            // You can emit a custom event if needed
            // this.emit('users', 'user_disconnected', { socketId: socket.id, reason })
        })

        socket.on('disconnecting', () => {
            // Handle any cleanup before socket fully disconnects
            // Rooms are still accessible here
        })
    }

    /**
     * Track socket activity for potential idle detection
     */
    private setupActivityTracking(socket: Socket): void {
        socket.onAny(() => {
            const socketInfo = this.connectedSockets.get(socket.id)
            if (socketInfo) {
                socketInfo.lastActivity = new Date()
            }
        })
    }

    // ==================== Utility Methods ====================

    /**
     * Emit to specific rooms
     */
    emit(rooms: string | string[], event: string, data: any): void {
        if (!this.io) return
        const targetRooms = Array.isArray(rooms) ? rooms : [rooms]
        this.io.to(targetRooms).emit(event, data)
    }

    /**
     * Emit to all connected sockets
     */
    emitToAll(event: string, data: any): void {
        this.emit('all', event, data)
    }

    /**
     * Emit to all authenticated users
     */
    emitToUsers(event: string, data: any): void {
        this.emit('users', event, data)
    }

    /**
     * Emit to all guests (non-authenticated)
     */
    emitToGuests(event: string, data: any): void {
        this.emit('guests', event, data)
    }

    /**
     * Emit to a specific user by ID
     */
    emitToUser(userId: string | number, event: string, data: any): void {
        this.emit(`user_${userId}`, event, data)
    }

    /**
     * Emit to multiple users by IDs
     */
    emitToUsers_ids(userIds: (string | number)[], event: string, data: any): void {
        const rooms = userIds.map(id => `user_${id}`)
        this.emit(rooms, event, data)
    }

    /**
     * Get all sockets for a specific user
     */
    async getUserSockets(userId: string | number): Promise<Socket[]> {
        if (!this.io) return []

        const userRoom = `user_${userId}`
        const clientIds = this.io.sockets.adapter.rooms.get(userRoom)

        if (!clientIds) return []

        return Array.from(clientIds)
            .map(id => this.io!.sockets.sockets.get(id))
            .filter((socket): socket is Socket => socket !== undefined)
    }

    /**
     * Make a user join a room
     */
    async userJoinRoom(userId: string | number, room: string): Promise<number> {
        const sockets = await this.getUserSockets(userId)
        await Promise.all(sockets.map(s => s.join(room)))

        // Update tracking
        for (const socket of sockets) {
            const info = this.connectedSockets.get(socket.id)
            if (info) info.rooms.add(room)
        }

        return sockets.length
    }

    /**
     * Make a user leave a room
     */
    async userLeaveRoom(userId: string | number, room: string): Promise<number> {
        const sockets = await this.getUserSockets(userId)
        await Promise.all(sockets.map(s => s.leave(room)))

        // Update tracking
        for (const socket of sockets) {
            const info = this.connectedSockets.get(socket.id)
            if (info) info.rooms.delete(room)
        }

        return sockets.length
    }

    /**
     * Check if a user is online
     */
    isUserOnline(userId: string | number): boolean {
        if (!this.io) return false
        const userRoom = `user_${userId}`
        const clients = this.io.sockets.adapter.rooms.get(userRoom)
        return clients !== undefined && clients.size > 0
    }

    /**
     * Get count of online users in a room
     */
    getRoomSize(room: string): number {
        if (!this.io) return 0
        return this.io.sockets.adapter.rooms.get(room)?.size ?? 0
    }

    /**
     * Get all connected socket info
     */
    getConnectedSockets(): Map<string, ConnectedUser> {
        return new Map(this.connectedSockets)
    }

    /**
     * Get count of all connected sockets
     */
    getConnectionCount(): number {
        return this.connectedSockets.size
    }

    /**
     * Get count of authenticated users (unique)
     */
    getAuthenticatedUserCount(): number {
        const uniqueUsers = new Set<string | number>()
        for (const [, info] of this.connectedSockets) {
            if (info.userId !== undefined) {
                uniqueUsers.add(info.userId)
            }
        }
        return uniqueUsers.size
    }

    /**
     * Disconnect a specific user from all their sockets
     */
    async disconnectUser(userId: string | number, reason?: string): Promise<number> {
        const sockets = await this.getUserSockets(userId)
        for (const socket of sockets) {
            socket.disconnect(true)
        }
        return sockets.length
    }

    /**
     * Broadcast to a room except sender
     */
    broadcastToRoom(socket: Socket, room: string, event: string, data: any): void {
        socket.to(room).emit(event, data)
    }

    // ==================== Device Methods ====================

    /**
     * Emit to a specific device
     */
    emitToDevice(deviceId: string, event: string, data: any): void {
        this.emit(`device_${deviceId}`, event, data)
    }

    /**
     * Emit to a specific device of a user
     * Useful when user has multiple devices and you want to target one
     */
    emitToUserDevice(userId: string | number, deviceId: string, event: string, data: any): void {
        if (!this.io) return

        const deviceSockets = this.deviceToSocket.get(deviceId)
        if (!deviceSockets) return

        for (const socketId of deviceSockets) {
            const socketInfo = this.connectedSockets.get(socketId)
            if (socketInfo?.userId === userId) {
                this.io.to(socketId).emit(event, data)
            }
        }
    }

    /**
     * Get all devices for a user
     */
    getUserDevices(userId: string | number): { deviceId: string; socketId: string; connectedAt: Date }[] {
        const devices: { deviceId: string; socketId: string; connectedAt: Date }[] = []

        for (const [socketId, info] of this.connectedSockets) {
            if (info.userId === userId && info.deviceId) {
                devices.push({
                    deviceId: info.deviceId,
                    socketId,
                    connectedAt: info.connectedAt,
                })
            }
        }

        return devices
    }

    /**
     * Get socket info for a device
     */
    getDeviceInfo(deviceId: string): ConnectedUser | undefined {
        const socketIds = this.deviceToSocket.get(deviceId)
        if (!socketIds || socketIds.size === 0) return undefined

        // Return the first socket info (a device might have multiple sockets in edge cases)
        const firstSocketId = socketIds.values().next().value
        return this.connectedSockets.get(firstSocketId)
    }

    /**
     * Check if a device is online
     */
    isDeviceOnline(deviceId: string): boolean {
        const sockets = this.deviceToSocket.get(deviceId)
        return sockets !== undefined && sockets.size > 0
    }

    /**
     * Disconnect a specific device
     */
    async disconnectDevice(deviceId: string, reason?: string): Promise<number> {
        if (!this.io) return 0

        const socketIds = this.deviceToSocket.get(deviceId)
        if (!socketIds) return 0

        let count = 0
        for (const socketId of socketIds) {
            const socket = this.io.sockets.sockets.get(socketId)
            if (socket) {
                socket.disconnect(true)
                count++
            }
        }

        return count
    }

    /**
     * Get all connected devices count
     */
    getDeviceCount(): number {
        return this.deviceToSocket.size
    }

    /**
     * Get devices for all online users
     * Returns a map of userId -> deviceIds[]
     */
    getOnlineUsersDevices(): Map<string | number, string[]> {
        const userDevices = new Map<string | number, string[]>()

        for (const [, info] of this.connectedSockets) {
            if (info.userId !== undefined && info.deviceId) {
                if (!userDevices.has(info.userId)) {
                    userDevices.set(info.userId, [])
                }
                const devices = userDevices.get(info.userId)!
                if (!devices.includes(info.deviceId)) {
                    devices.push(info.deviceId)
                }
            }
        }

        return userDevices
    }

    async beforeRun(): Promise<void> {
        // Nothing to do
    }

    async run(): Promise<void> {
        // Nothing to do
    }

    async afterRun(): Promise<void> {
        // Nothing to do
    }
}
