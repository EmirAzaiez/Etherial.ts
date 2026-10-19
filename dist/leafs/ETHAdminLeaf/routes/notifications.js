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
import { Controller, Get, Post } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { AdminNotification } from '../models/AdminNotification.js';
import { adminUserLabel, loadUsers, userIdOf } from '../features/notifications.js';
const getAdminLeaf = () => etherial.eth_admin_leaf;
/**
 * The signed-in person, if they may open the back-office. Every route below
 * reads and writes only that person's rows: there is no way to name another
 * user's inbox.
 */
function inboxOwner(req) {
    return __awaiter(this, void 0, void 0, function* () {
        const adminLeaf = getAdminLeaf();
        if (!adminLeaf || !(yield adminLeaf.canAccessAdmin(req.user)))
            return null;
        return userIdOf(req.user);
    });
}
const unreadOf = (userId) => AdminNotification.count({ where: { user_id: userId, read_at: null } });
let ETHAdminNotificationsController = class ETHAdminNotificationsController {
    /**
     * GET /admin/notifications?unread=1&page=1&limit=20
     *
     * The person's notifications, newest first, each with who caused it.
     */
    list(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const userId = yield inboxOwner(req);
            if (userId === null) {
                return res.error({ status: 403, errors: ['forbidden'] });
            }
            const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
            const page = Math.max(Number(req.query.page) || 1, 1);
            const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';
            const where = { user_id: userId };
            if (unreadOnly)
                where.read_at = null;
            const [{ rows, count }, unread] = yield Promise.all([
                AdminNotification.findAndCountAll({ where, order: [['id', 'DESC']], limit, offset: (page - 1) * limit }),
                unreadOf(userId),
            ]);
            const actors = yield loadUsers(rows.map((row) => row.actor_id).filter((id) => id !== null));
            const items = rows.map((row) => {
                const actor = row.actor_id !== null ? actors.get(row.actor_id) : null;
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
                };
            });
            return res.success({ status: 200, data: { items, total: count, unread } });
        });
    }
    /** GET /admin/notifications/unread-count: what the bell polls. */
    unreadCount(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const userId = yield inboxOwner(req);
            if (userId === null) {
                return res.error({ status: 403, errors: ['forbidden'] });
            }
            return res.success({ status: 200, data: { unread: yield unreadOf(userId) } });
        });
    }
    /** POST /admin/notifications/:id/read */
    markRead(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const userId = yield inboxOwner(req);
            if (userId === null) {
                return res.error({ status: 403, errors: ['forbidden'] });
            }
            const id = Number(req.params.id);
            if (!Number.isInteger(id) || id <= 0) {
                return res.error({ status: 400, errors: ['invalid_id'] });
            }
            // Scoped to the owner: someone else's id is simply not found.
            const row = yield AdminNotification.findOne({ where: { id, user_id: userId } });
            if (!row) {
                return res.error({ status: 404, errors: ['not_found'] });
            }
            if (!row.read_at)
                yield row.update({ read_at: new Date() });
            return res.success({ status: 200, data: { id, read_at: row.read_at, unread: yield unreadOf(userId) } });
        });
    }
    /** POST /admin/notifications/read-all */
    markAllRead(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const userId = yield inboxOwner(req);
            if (userId === null) {
                return res.error({ status: 403, errors: ['forbidden'] });
            }
            const [updated] = yield AdminNotification.update({ read_at: new Date() }, {
                where: { user_id: userId, read_at: null },
            });
            return res.success({ status: 200, data: { updated, unread: 0 } });
        });
    }
};
__decorate([
    Get('/admin/notifications'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAdminNotificationsController.prototype, "list", null);
__decorate([
    Get('/admin/notifications/unread-count'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAdminNotificationsController.prototype, "unreadCount", null);
__decorate([
    Post('/admin/notifications/:id/read'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAdminNotificationsController.prototype, "markRead", null);
__decorate([
    Post('/admin/notifications/read-all'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAdminNotificationsController.prototype, "markAllRead", null);
ETHAdminNotificationsController = __decorate([
    Controller()
], ETHAdminNotificationsController);
export default ETHAdminNotificationsController;
