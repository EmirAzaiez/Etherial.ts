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
import { Op } from 'sequelize';
import { Controller, Get, Post } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { AdminAuditLog } from '../models/AdminAuditLog.js';
import { auditOf, withAuditMeta } from '../features/audit.js';
const getAdminLeaf = () => etherial.eth_admin_leaf;
const isPlaceholder = (value) => !!value && typeof value === 'object' && ('__masked' in value || '__truncated' in value);
const same = (a, b) => JSON.stringify(a !== null && a !== void 0 ? a : null) === JSON.stringify(b !== null && b !== void 0 ? b : null);
/** What a stored value looks like next to the live one: the same JSON-safe form. */
function comparable(value) {
    if (value === undefined || value === null)
        return null;
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === 'object')
        return JSON.parse(JSON.stringify(value));
    if (typeof value === 'number' || typeof value === 'boolean')
        return value;
    const n = Number(value);
    return value !== '' && !Number.isNaN(n) && String(n) === String(value) ? n : value;
}
/** Columns of an edit that can be put back: kept in full, still in the model, editable in the back-office. */
function restorableFields(entry, collection) {
    var _a, _b, _c, _d;
    if (entry.action !== 'update')
        return [];
    const attributes = (_b = (_a = collection.model) === null || _a === void 0 ? void 0 : _a.rawAttributes) !== null && _b !== void 0 ? _b : {};
    const readonly = new Set(((_c = collection.fields) !== null && _c !== void 0 ? _c : []).filter((f) => f.readonly).map((f) => f.name));
    return Object.entries((_d = entry.changes) !== null && _d !== void 0 ? _d : {})
        .filter(([field, [before]]) => field in attributes && !readonly.has(field) && !isPlaceholder(before))
        .map(([field]) => field);
}
let ETHAdminAuditController = class ETHAdminAuditController {
    /**
     * GET /admin/audit/:collection/:id?before=<entry id>&limit=30&source=salesforce
     *
     * The record's changes, newest first. Whoever may open the record may read
     * them; `canRestore` says whether they may also undo one. The first page
     * also counts the entries per source, for the filter.
     */
    history(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const adminLeaf = getAdminLeaf();
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(req.params.collection);
            const audit = auditOf(collection);
            if (!collection || !audit) {
                return res.error({ status: 404, errors: ['not_tracked'] });
            }
            if (!(yield adminLeaf.checkAccess(req.user, req.params.collection, 'show'))) {
                return res.error({ status: 403, errors: ['forbidden'] });
            }
            const before = req.query.before ? Number(req.query.before) : undefined;
            if (before !== undefined && (!Number.isInteger(before) || before <= 0)) {
                return res.error({ status: 400, errors: ['invalid_cursor'] });
            }
            const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
            const source = typeof req.query.source === 'string' && req.query.source ? req.query.source : undefined;
            const ofRecord = { model: audit.model.name, record_id: String(req.params.id) };
            const rows = yield AdminAuditLog.findAll({
                where: Object.assign(Object.assign(Object.assign({}, ofRecord), (source ? { source } : {})), (before ? { id: { [Op.lt]: before } } : {})),
                order: [['id', 'DESC']],
                limit,
            });
            let counts;
            if (!before) {
                const grouped = (yield AdminAuditLog.count({ where: ofRecord, group: ['source'] }));
                counts = Object.fromEntries(grouped.map((g) => { var _a; return [(_a = g.source) !== null && _a !== void 0 ? _a : 'system', Number(g.count)]; }));
            }
            const canRestore = yield adminLeaf.checkAccess(req.user, req.params.collection, 'update');
            const paranoid = !!((_b = (_a = collection.model) === null || _a === void 0 ? void 0 : _a.options) === null || _b === void 0 ? void 0 : _b.paranoid);
            const items = rows.map((entry) => {
                var _a;
                return ({
                    id: entry.id,
                    action: entry.action,
                    at: entry.created_at,
                    actor: { type: entry.actor_type, id: entry.actor_id, label: entry.actor_label },
                    source: entry.source,
                    meta: entry.meta,
                    changes: Object.entries((_a = entry.changes) !== null && _a !== void 0 ? _a : {}).map(([field, [from, to]]) => ({ field, before: from, after: to })),
                    restorable: entry.action === 'delete' ? paranoid : restorableFields(entry, collection).length > 0,
                });
            });
            return res.success({
                status: 200,
                data: { items, canRestore, counts, nextBefore: rows.length === limit ? rows[rows.length - 1].id : null },
            });
        });
    }
    /**
     * POST /admin/audit/:entry/restore  { fields?: string[], force?: boolean }
     *
     * Puts back what an edit replaced, or brings back a soft-deleted record.
     * A column changed again since that edit is a conflict: nothing is written
     * and the answer lists them, unless `force` is set. The restore goes
     * through the collection's own update hooks and is recorded like any edit.
     */
    restore(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const adminLeaf = getAdminLeaf();
            const entry = yield AdminAuditLog.findByPk(Number(req.params.entry) || 0);
            if (!entry) {
                return res.error({ status: 404, errors: ['not_found'] });
            }
            // The collection the entry was recorded under, or any other showing the same model.
            const collections = (_a = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.collections) !== null && _a !== void 0 ? _a : [];
            const collection = (_b = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(entry.collection)) !== null && _b !== void 0 ? _b : collections.find((c) => { var _a; return ((_a = c.model) === null || _a === void 0 ? void 0 : _a.name) === entry.model; });
            if (!collection || !(yield adminLeaf.checkAccess(req.user, collection.name, 'update'))) {
                return res.error({ status: 403, errors: ['forbidden'] });
            }
            const meta = { restored_from: entry.id };
            if (entry.action === 'delete') {
                const record = yield collection.model.findByPk(entry.record_id, { paranoid: false });
                if (!record)
                    return res.error({ status: 409, errors: ['record_gone'] });
                if (!((_c = collection.model.options) === null || _c === void 0 ? void 0 : _c.paranoid) || !((_d = record.isSoftDeleted) === null || _d === void 0 ? void 0 : _d.call(record))) {
                    return res.error({ status: 409, errors: ['not_restorable'] });
                }
                yield withAuditMeta(meta, () => record.restore());
                return res.success({ status: 200, data: { restored: true, fields: [] } });
            }
            const allowed = restorableFields(entry, collection);
            const asked = Array.isArray((_e = req.body) === null || _e === void 0 ? void 0 : _e.fields) ? req.body.fields : undefined;
            const fields = asked ? allowed.filter((f) => asked.includes(f)) : allowed;
            if (fields.length === 0) {
                return res.error({ status: 409, errors: ['not_restorable'] });
            }
            const record = yield collection.model.findByPk(entry.record_id);
            if (!record)
                return res.error({ status: 409, errors: ['record_gone'] });
            const conflicts = fields
                .map((field) => ({ field, expected: entry.changes[field][1], current: comparable(record.get(field)) }))
                .filter(({ expected, current }) => !same(comparable(expected), current));
            if (conflicts.length > 0 && !((_f = req.body) === null || _f === void 0 ? void 0 : _f.force)) {
                return res.success({ status: 200, data: { restored: false, conflicts } });
            }
            let data = Object.fromEntries(fields.map((f) => [f, entry.changes[f][0]]));
            const hooks = adminLeaf.getResolvedHooks(collection.name);
            yield withAuditMeta(meta, () => __awaiter(this, void 0, void 0, function* () {
                var _a;
                if (hooks === null || hooks === void 0 ? void 0 : hooks.beforeUpdate)
                    data = (_a = (yield hooks.beforeUpdate(record, data, req))) !== null && _a !== void 0 ? _a : data;
                yield record.update(data);
                if (hooks === null || hooks === void 0 ? void 0 : hooks.afterUpdate)
                    yield hooks.afterUpdate(record, req);
            }));
            return res.success({ status: 200, data: { restored: true, fields } });
        });
    }
};
__decorate([
    Get('/admin/audit/:collection/:id'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAdminAuditController.prototype, "history", null);
__decorate([
    Post('/admin/audit/:entry/restore'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAdminAuditController.prototype, "restore", null);
ETHAdminAuditController = __decorate([
    Controller()
], ETHAdminAuditController);
export default ETHAdminAuditController;
