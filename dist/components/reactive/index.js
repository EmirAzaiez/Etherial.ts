var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Server } from 'socket.io';
import etherial from '../../index';
export class Reactive {
    constructor(config = {}) {
        this.io = null;
        this.connectedSockets = new Map();
        this.middlewares = [];
        this.globalListeners = [];
        this.config = config;
    }
    /**
     * Add middleware to be executed on each socket connection
     */
    useMiddleware(middleware) {
        this.middlewares.push(middleware);
        return this;
    }
    /**
     * Add global listener for all sockets
     */
    on(event, callback) {
        this.globalListeners.push({ event, callback });
        return this;
    }
    /**
     * Start listening for socket connections
     */
    listen(listeners = []) {
        return new Promise((resolve) => {
            var _a, _b, _c, _d, _e;
            const httpServer = (_a = etherial['http']) === null || _a === void 0 ? void 0 : _a.server;
            if (!httpServer) {
                console.error('[Reactive] HTTP server not found. Make sure to initialize http module first.');
                resolve(false);
                return;
            }
            this.io = new Server(httpServer, {
                cors: (_b = this.config.cors) !== null && _b !== void 0 ? _b : {
                    origin: '*',
                    methods: ['PUT', 'GET', 'POST', 'DELETE', 'OPTIONS'],
                    credentials: false,
                },
                pingInterval: (_c = this.config.pingInterval) !== null && _c !== void 0 ? _c : 25000,
                pingTimeout: (_d = this.config.pingTimeout) !== null && _d !== void 0 ? _d : 20000,
                maxHttpBufferSize: (_e = this.config.maxHttpBufferSize) !== null && _e !== void 0 ? _e : 1e6,
            });
            // Apply middlewares
            for (const middleware of this.middlewares) {
                this.io.use(middleware);
            }
            this.io.on('connection', (socket) => {
                this.handleConnection(socket, [...listeners, ...this.globalListeners]);
            });
            console.log('[Reactive] Socket.io server initialized');
            resolve(true);
        });
    }
    /**
     * Handle new socket connection
     */
    handleConnection(socket, listeners) {
        // Track socket
        this.connectedSockets.set(socket.id, {
            socketId: socket.id,
            rooms: new Set(['all', 'guests']),
            connectedAt: new Date(),
            lastActivity: new Date(),
        });
        // Join default rooms
        socket.join('all');
        socket.join('guests');
        // Setup handlers
        this.setupAuthHandlers(socket);
        this.setupListeners(socket, listeners);
        this.setupDisconnectHandler(socket);
        this.setupActivityTracking(socket);
        // Emit connection event
        socket.emit('connected', {
            socketId: socket.id,
            timestamp: Date.now(),
        });
    }
    /**
     * Setup authentication handlers
     */
    setupAuthHandlers(socket) {
        const httpAuth = etherial['http_auth'];
        socket.on('auth', (token, callback) => __awaiter(this, void 0, void 0, function* () {
            if (!httpAuth) {
                callback === null || callback === void 0 ? void 0 : callback({ success: false, error: 'Auth module not available' });
                return;
            }
            try {
                const payload = httpAuth.verifyToken(token);
                if (!payload) {
                    callback === null || callback === void 0 ? void 0 : callback({ success: false, error: 'Invalid token' });
                    return;
                }
                const userId = payload.id || payload.user_id;
                const userRoom = `user_${userId}`;
                // Update tracking
                const socketInfo = this.connectedSockets.get(socket.id);
                if (socketInfo) {
                    socketInfo.userId = userId;
                    socketInfo.rooms.delete('guests');
                    socketInfo.rooms.add('users');
                    socketInfo.rooms.add(userRoom);
                }
                // Update rooms
                yield socket.leave('guests');
                socket.join('users');
                socket.join(userRoom);
                callback === null || callback === void 0 ? void 0 : callback({ success: true });
                socket.emit('authenticated', { userId });
            }
            catch (error) {
                callback === null || callback === void 0 ? void 0 : callback({ success: false, error: 'Authentication failed' });
            }
        }));
        socket.on('deauth', (callback) => __awaiter(this, void 0, void 0, function* () {
            yield this.deauthenticateSocket(socket);
            callback === null || callback === void 0 ? void 0 : callback({ success: true });
        }));
    }
    /**
     * Deauthenticate a socket
     */
    deauthenticateSocket(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            const socketInfo = this.connectedSockets.get(socket.id);
            // Leave all rooms except socket.id and 'all'
            const rooms = Array.from(socket.rooms);
            const leavePromises = rooms
                .filter(room => room !== socket.id && room !== 'all')
                .map(room => socket.leave(room));
            yield Promise.all(leavePromises);
            // Reset to guest
            socket.join('guests');
            // Update tracking
            if (socketInfo) {
                socketInfo.userId = undefined;
                socketInfo.rooms = new Set(['all', 'guests']);
            }
            socket.emit('deauthenticated');
        });
    }
    /**
     * Setup custom event listeners
     */
    setupListeners(socket, listeners) {
        for (const listener of listeners) {
            socket.on(listener.event, (data) => __awaiter(this, void 0, void 0, function* () {
                // Update activity
                const socketInfo = this.connectedSockets.get(socket.id);
                if (socketInfo) {
                    socketInfo.lastActivity = new Date();
                }
                try {
                    yield listener.callback(data, socket);
                }
                catch (error) {
                    console.error(`[Reactive] Error in listener "${listener.event}":`, error);
                    socket.emit('error', {
                        event: listener.event,
                        message: 'An error occurred processing your request',
                    });
                }
            }));
        }
    }
    /**
     * Setup disconnect handler
     */
    setupDisconnectHandler(socket) {
        socket.on('disconnect', (reason) => {
            this.connectedSockets.delete(socket.id);
            // You can emit a custom event if needed
            // this.emit('users', 'user_disconnected', { socketId: socket.id, reason })
        });
        socket.on('disconnecting', () => {
            // Handle any cleanup before socket fully disconnects
            // Rooms are still accessible here
        });
    }
    /**
     * Track socket activity for potential idle detection
     */
    setupActivityTracking(socket) {
        socket.onAny(() => {
            const socketInfo = this.connectedSockets.get(socket.id);
            if (socketInfo) {
                socketInfo.lastActivity = new Date();
            }
        });
    }
    // ==================== Utility Methods ====================
    /**
     * Emit to specific rooms
     */
    emit(rooms, event, data) {
        if (!this.io)
            return;
        const targetRooms = Array.isArray(rooms) ? rooms : [rooms];
        this.io.to(targetRooms).emit(event, data);
    }
    /**
     * Emit to all connected sockets
     */
    emitToAll(event, data) {
        this.emit('all', event, data);
    }
    /**
     * Emit to all authenticated users
     */
    emitToUsers(event, data) {
        this.emit('users', event, data);
    }
    /**
     * Emit to all guests (non-authenticated)
     */
    emitToGuests(event, data) {
        this.emit('guests', event, data);
    }
    /**
     * Emit to a specific user by ID
     */
    emitToUser(userId, event, data) {
        this.emit(`user_${userId}`, event, data);
    }
    /**
     * Emit to multiple users by IDs
     */
    emitToUsers_ids(userIds, event, data) {
        const rooms = userIds.map(id => `user_${id}`);
        this.emit(rooms, event, data);
    }
    /**
     * Get all sockets for a specific user
     */
    getUserSockets(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.io)
                return [];
            const userRoom = `user_${userId}`;
            const clientIds = this.io.sockets.adapter.rooms.get(userRoom);
            if (!clientIds)
                return [];
            return Array.from(clientIds)
                .map(id => this.io.sockets.sockets.get(id))
                .filter((socket) => socket !== undefined);
        });
    }
    /**
     * Make a user join a room
     */
    userJoinRoom(userId, room) {
        return __awaiter(this, void 0, void 0, function* () {
            const sockets = yield this.getUserSockets(userId);
            yield Promise.all(sockets.map(s => s.join(room)));
            // Update tracking
            for (const socket of sockets) {
                const info = this.connectedSockets.get(socket.id);
                if (info)
                    info.rooms.add(room);
            }
            return sockets.length;
        });
    }
    /**
     * Make a user leave a room
     */
    userLeaveRoom(userId, room) {
        return __awaiter(this, void 0, void 0, function* () {
            const sockets = yield this.getUserSockets(userId);
            yield Promise.all(sockets.map(s => s.leave(room)));
            // Update tracking
            for (const socket of sockets) {
                const info = this.connectedSockets.get(socket.id);
                if (info)
                    info.rooms.delete(room);
            }
            return sockets.length;
        });
    }
    /**
     * Check if a user is online
     */
    isUserOnline(userId) {
        if (!this.io)
            return false;
        const userRoom = `user_${userId}`;
        const clients = this.io.sockets.adapter.rooms.get(userRoom);
        return clients !== undefined && clients.size > 0;
    }
    /**
     * Get count of online users in a room
     */
    getRoomSize(room) {
        var _a, _b;
        if (!this.io)
            return 0;
        return (_b = (_a = this.io.sockets.adapter.rooms.get(room)) === null || _a === void 0 ? void 0 : _a.size) !== null && _b !== void 0 ? _b : 0;
    }
    /**
     * Get all connected socket info
     */
    getConnectedSockets() {
        return new Map(this.connectedSockets);
    }
    /**
     * Get count of all connected sockets
     */
    getConnectionCount() {
        return this.connectedSockets.size;
    }
    /**
     * Get count of authenticated users (unique)
     */
    getAuthenticatedUserCount() {
        const uniqueUsers = new Set();
        for (const [, info] of this.connectedSockets) {
            if (info.userId !== undefined) {
                uniqueUsers.add(info.userId);
            }
        }
        return uniqueUsers.size;
    }
    /**
     * Disconnect a specific user from all their sockets
     */
    disconnectUser(userId, reason) {
        return __awaiter(this, void 0, void 0, function* () {
            const sockets = yield this.getUserSockets(userId);
            for (const socket of sockets) {
                socket.disconnect(true);
            }
            return sockets.length;
        });
    }
    /**
     * Broadcast to a room except sender
     */
    broadcastToRoom(socket, room, event, data) {
        socket.to(room).emit(event, data);
    }
    beforeRun() {
        return __awaiter(this, void 0, void 0, function* () {
            // Nothing to do
        });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            // Nothing to do
        });
    }
    afterRun() {
        return __awaiter(this, void 0, void 0, function* () {
            // Nothing to do
        });
    }
}
