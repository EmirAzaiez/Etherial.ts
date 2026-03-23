var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from 'etherial';
import { Controller, Get } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
const getAdminLeaf = () => etherial.eth_admin_leaf;
const getReactive = () => {
    // Try different possible module names
    const reactive = etherial.reactive || etherial['reactive'];
    if (!reactive) {
        console.log('[ReactiveController] Available etherial modules:', Object.keys(etherial));
    }
    return reactive;
};
let ReactiveController = class ReactiveController {
    /**
     * Debug endpoint to check reactive module status
     */
    debug(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            const adminLeaf = getAdminLeaf();
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.canAccessAdmin(req.user));
            if (!hasAccess) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 403, errors: ['forbidden'] });
            }
            const reactive = getReactive();
            const modules = Object.keys(etherial);
            // Get more details from Socket.io
            let ioDetails = null;
            if (reactive === null || reactive === void 0 ? void 0 : reactive.io) {
                const io = reactive.io;
                const adapter = (_c = io.sockets) === null || _c === void 0 ? void 0 : _c.adapter;
                ioDetails = {
                    engineClientsCount: (_e = (_d = io.engine) === null || _d === void 0 ? void 0 : _d.clientsCount) !== null && _e !== void 0 ? _e : 0,
                    socketsSize: (_h = (_g = (_f = io.sockets) === null || _f === void 0 ? void 0 : _f.sockets) === null || _g === void 0 ? void 0 : _g.size) !== null && _h !== void 0 ? _h : 0,
                    rooms: (adapter === null || adapter === void 0 ? void 0 : adapter.rooms) ? Array.from(adapter.rooms.keys()) : [],
                    roomsSizes: {}
                };
                // Get size of each room
                if (adapter === null || adapter === void 0 ? void 0 : adapter.rooms) {
                    for (const [roomName, sockets] of adapter.rooms) {
                        ioDetails.roomsSizes[roomName] = sockets.size;
                    }
                }
            }
            // Get connectedSockets from reactive
            const connectedSockets = (_j = reactive === null || reactive === void 0 ? void 0 : reactive.getConnectedSockets) === null || _j === void 0 ? void 0 : _j.call(reactive);
            const connectedSocketsInfo = connectedSockets ? {
                size: connectedSockets.size,
                sockets: Array.from(connectedSockets.entries()).map(([id, info]) => ({
                    socketId: id,
                    userId: info.userId,
                    rooms: Array.from(info.rooms),
                    connectedAt: info.connectedAt,
                    lastActivity: info.lastActivity
                }))
            } : null;
            return (_l = (_k = res).success) === null || _l === void 0 ? void 0 : _l.call(_k, {
                status: 200,
                data: {
                    availableModules: modules,
                    reactiveFound: !!reactive,
                    reactiveType: reactive ? typeof reactive : null,
                    reactiveHasIo: (reactive === null || reactive === void 0 ? void 0 : reactive.io) ? true : false,
                    ioDetails,
                    connectedSockets: connectedSocketsInfo,
                    reactiveMethods: reactive ? Object.getOwnPropertyNames(Object.getPrototypeOf(reactive)).filter(m => m !== 'constructor') : []
                }
            });
        });
    }
    /**
     * Get real-time statistics for reactive connections
     * Returns counts for total, guests, and authenticated users
     */
    getStats(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const adminLeaf = getAdminLeaf();
            const reactive = getReactive();
            // Check if user has access to admin
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.canAccessAdmin(req.user));
            if (!hasAccess) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 403, errors: ['forbidden'] });
            }
            if (!reactive) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, {
                    status: 500,
                    errors: ['reactive_not_initialized'],
                    debug: { availableModules: Object.keys(etherial) }
                });
            }
            const stats = {
                total: reactive.getConnectionCount(),
                guests: reactive.getRoomSize('guests'),
                authenticated: reactive.getRoomSize('users'),
                uniqueUsers: reactive.getAuthenticatedUserCount(),
                rooms: {
                    all: reactive.getRoomSize('all'),
                    guests: reactive.getRoomSize('guests'),
                    users: reactive.getRoomSize('users')
                }
            };
            return (_f = (_e = res).success) === null || _f === void 0 ? void 0 : _f.call(_e, {
                status: 200,
                data: stats
            });
        });
    }
    /**
     * Get all connected sockets with details
     * Returns list of all connections (guests + authenticated)
     */
    getConnections(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const adminLeaf = getAdminLeaf();
            const reactive = getReactive();
            // Check if user has access to admin
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.canAccessAdmin(req.user));
            if (!hasAccess) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 403, errors: ['forbidden'] });
            }
            if (!reactive) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 500, errors: ['reactive_not_initialized'] });
            }
            const connectedSockets = reactive.getConnectedSockets();
            const connections = yield this.enrichConnections(connectedSockets);
            return (_f = (_e = res).success) === null || _f === void 0 ? void 0 : _f.call(_e, {
                status: 200,
                data: {
                    total: connections.length,
                    connections
                }
            });
        });
    }
    /**
     * Get authenticated users only
     * Returns list of all authenticated user connections
     */
    getAuthenticatedUsers(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const adminLeaf = getAdminLeaf();
            const reactive = getReactive();
            // Check if user has access to admin
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.canAccessAdmin(req.user));
            if (!hasAccess) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 403, errors: ['forbidden'] });
            }
            if (!reactive) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 500, errors: ['reactive_not_initialized'] });
            }
            const connectedSockets = reactive.getConnectedSockets();
            const allConnections = yield this.enrichConnections(connectedSockets);
            // Filter only authenticated users
            const authenticatedConnections = allConnections.filter(c => c.isAuthenticated);
            // Group by userId to show unique users with their socket count
            const userMap = new Map();
            for (const conn of authenticatedConnections) {
                if (conn.userId) {
                    const existing = userMap.get(conn.userId);
                    if (existing) {
                        existing.sockets.push({
                            socketId: conn.socketId,
                            connectedAt: conn.connectedAt,
                            lastActivity: conn.lastActivity,
                            rooms: conn.rooms
                        });
                    }
                    else {
                        userMap.set(conn.userId, {
                            user: conn.user,
                            sockets: [{
                                    socketId: conn.socketId,
                                    connectedAt: conn.connectedAt,
                                    lastActivity: conn.lastActivity,
                                    rooms: conn.rooms
                                }]
                        });
                    }
                }
            }
            const users = Array.from(userMap.entries()).map(([userId, data]) => ({
                userId,
                user: data.user,
                socketCount: data.sockets.length,
                sockets: data.sockets
            }));
            return (_f = (_e = res).success) === null || _f === void 0 ? void 0 : _f.call(_e, {
                status: 200,
                data: {
                    uniqueUsers: users.length,
                    totalSockets: authenticatedConnections.length,
                    users
                }
            });
        });
    }
    /**
     * Get guest connections only
     * Returns list of all unauthenticated connections
     */
    getGuests(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const adminLeaf = getAdminLeaf();
            const reactive = getReactive();
            // Check if user has access to admin
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.canAccessAdmin(req.user));
            if (!hasAccess) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 403, errors: ['forbidden'] });
            }
            if (!reactive) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 500, errors: ['reactive_not_initialized'] });
            }
            const connectedSockets = reactive.getConnectedSockets();
            const allConnections = yield this.enrichConnections(connectedSockets);
            // Filter only guests (non-authenticated)
            const guestConnections = allConnections.filter(c => !c.isAuthenticated);
            return (_f = (_e = res).success) === null || _f === void 0 ? void 0 : _f.call(_e, {
                status: 200,
                data: {
                    total: guestConnections.length,
                    guests: guestConnections.map(g => ({
                        socketId: g.socketId,
                        rooms: g.rooms,
                        connectedAt: g.connectedAt,
                        lastActivity: g.lastActivity
                    }))
                }
            });
        });
    }
    /**
     * Check if a specific user is online
     */
    getUserStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const adminLeaf = getAdminLeaf();
            const reactive = getReactive();
            // Check if user has access to admin
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.canAccessAdmin(req.user));
            if (!hasAccess) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 403, errors: ['forbidden'] });
            }
            if (!reactive) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 500, errors: ['reactive_not_initialized'] });
            }
            const userId = parseInt(req.params.userId);
            const isOnline = reactive.isUserOnline(userId);
            // Get user sockets if online
            let sockets = [];
            if (isOnline) {
                const connectedSockets = reactive.getConnectedSockets();
                for (const [, info] of connectedSockets) {
                    if (info.userId === userId) {
                        sockets.push({
                            socketId: info.socketId,
                            rooms: Array.from(info.rooms),
                            connectedAt: info.connectedAt,
                            lastActivity: info.lastActivity
                        });
                    }
                }
            }
            return (_f = (_e = res).success) === null || _f === void 0 ? void 0 : _f.call(_e, {
                status: 200,
                data: {
                    userId,
                    isOnline,
                    socketCount: sockets.length,
                    sockets
                }
            });
        });
    }
    /**
     * Enrich socket connections with user data from database
     */
    enrichConnections(connectedSockets) {
        return __awaiter(this, void 0, void 0, function* () {
            const connections = [];
            const userIds = new Set();
            // Collect user IDs
            for (const [, info] of connectedSockets) {
                if (info.userId) {
                    userIds.add(Number(info.userId));
                }
            }
            // Fetch user data from database
            let usersMap = new Map();
            if (userIds.size > 0) {
                try {
                    const etherial = require('etherial').default;
                    const User = etherial.database.sequelize.models.User;
                    const rawAttrs = Object.keys(User.rawAttributes || {});
                    const pick = (options) => options.find(attr => rawAttrs.includes(attr));
                    const attributes = [
                        'id',
                        pick(['first_name', 'firstname']),
                        pick(['last_name', 'lastname']),
                        pick(['email']),
                        pick(['phone_number', 'phone']),
                        pick(['role']),
                    ].filter(Boolean);
                    const users = yield User.findAll({
                        where: { id: Array.from(userIds) },
                        attributes,
                    });
                    for (const user of users) {
                        usersMap.set(user.id, user.toJSON());
                    }
                }
                catch (error) {
                    console.error('[ReactiveController] Error fetching users:', error);
                }
            }
            // Build connections list
            for (const [, info] of connectedSockets) {
                const isAuthenticated = info.userId !== undefined;
                connections.push({
                    socketId: info.socketId,
                    userId: info.userId,
                    user: info.userId ? usersMap.get(Number(info.userId)) || null : null,
                    rooms: Array.from(info.rooms),
                    connectedAt: info.connectedAt,
                    lastActivity: info.lastActivity,
                    isAuthenticated
                });
            }
            return connections;
        });
    }
};
__decorate([
    Get('/admin/reactive/debug'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReactiveController.prototype, "debug", null);
__decorate([
    Get('/admin/reactive/stats'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReactiveController.prototype, "getStats", null);
__decorate([
    Get('/admin/reactive/connections'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReactiveController.prototype, "getConnections", null);
__decorate([
    Get('/admin/reactive/users'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReactiveController.prototype, "getAuthenticatedUsers", null);
__decorate([
    Get('/admin/reactive/guests'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReactiveController.prototype, "getGuests", null);
__decorate([
    Get('/admin/reactive/users/:userId/status'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ReactiveController.prototype, "getUserStatus", null);
ReactiveController = __decorate([
    Controller()
], ReactiveController);
export default ReactiveController;
export const AvailableRouteMethods = [
    'debug',
    'getStats',
    'getConnections',
    'getAuthenticatedUsers',
    'getGuests',
    'getUserStatus'
];
