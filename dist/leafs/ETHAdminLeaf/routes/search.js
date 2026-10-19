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
import { Controller, Get } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { isSecretColumn } from '../features/access.js';
const getAdminLeaf = () => etherial.eth_admin_leaf;
/** Column names that hold a credential even when the collection did not flag them `secure`. */
const SECRET_NAME = /pass(word)?|secret|token|otp|api_?key|hash/i;
/** Where a record's name usually lives, in the order the back-office reads them. */
const TITLE_FIELDS = ['name', 'title', 'label', 'subject', 'full_name', 'real_name', 'email', 'message'];
const NAME_PAIRS = [['first_name', 'last_name'], ['firstname', 'lastname']];
/** Collections searched at once: enough to answer fast, few enough to leave the pool to everyone else. */
const CONCURRENCY = 6;
/** A value as one line of text: translated fields (`{ en, ar }`) show their English, then whatever they have. */
function asText(value) {
    var _a;
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'object') {
        const obj = value;
        const first = (_a = obj.en) !== null && _a !== void 0 ? _a : Object.values(obj).find((v) => typeof v === 'string' && v);
        return typeof first === 'string' ? first.trim() : '';
    }
    return String(value).replace(/\s+/g, ' ').trim();
}
/** Columns of the model the search may read: real columns, never a secret. */
function readableColumns(collection) {
    var _a, _b, _c;
    const attributes = Object.keys((_b = (_a = collection.model) === null || _a === void 0 ? void 0 : _a.rawAttributes) !== null && _b !== void 0 ? _b : {});
    const secure = new Set(((_c = collection.fields) !== null && _c !== void 0 ? _c : []).filter((f) => f.secure).map((f) => f.name));
    return new Set(attributes.filter((name) => !secure.has(name) && !isSecretColumn(name) && !SECRET_NAME.test(name)));
}
function titleOf(row, searchFields) {
    for (const name of TITLE_FIELDS) {
        const text = asText(row[name]);
        if (text) {
            return { title: text, from: [name] };
        }
    }
    for (const [first, last] of NAME_PAIRS) {
        const text = [asText(row[first]), asText(row[last])].filter(Boolean).join(' ');
        if (text) {
            return { title: text, from: [first, last] };
        }
    }
    for (const name of searchFields) {
        const text = asText(row[name]);
        if (text) {
            return { title: text, from: [name] };
        }
    }
    return { title: '', from: [] };
}
function searchCollection(collection, q, limit) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const readable = readableColumns(collection);
        const searchFields = ((_c = (_b = (_a = collection.views) === null || _a === void 0 ? void 0 : _a.list) === null || _b === void 0 ? void 0 : _b.search) !== null && _c !== void 0 ? _c : []).filter((f) => readable.has(f));
        if (searchFields.length === 0) {
            return [];
        }
        const primaryKey = collection.model.primaryKeyAttribute || 'id';
        const titleColumns = [...TITLE_FIELDS, ...NAME_PAIRS.flat()].filter((f) => readable.has(f));
        const attributes = Array.from(new Set([primaryKey, ...titleColumns, ...searchFields]));
        const rows = yield collection.model.findAll({
            where: { [Op.or]: searchFields.map((field) => ({ [field]: { [Op.iLike]: `%${q}%` } })) },
            attributes,
            order: [[primaryKey, 'DESC']],
            limit,
            raw: true,
        });
        return rows.map((row) => {
            const { title, from } = titleOf(row, searchFields);
            // The field that matched, when it is not the title already: how one
            // tells two "John Smith" apart, and why a record came up at all.
            const needle = q.toLowerCase();
            const matched = searchFields.find((f) => !from.includes(f) && asText(row[f]).toLowerCase().includes(needle));
            const subtitle = matched ? asText(row[matched]) : undefined;
            const id = row[primaryKey];
            return Object.assign({ id, title: title || `#${id}` }, (subtitle && subtitle !== title ? { subtitle } : {}));
        });
    });
}
/** `fn` over `list`, `size` at a time, in order. */
function mapPool(list, size, fn) {
    return __awaiter(this, void 0, void 0, function* () {
        const out = new Array(list.length);
        let next = 0;
        const worker = () => __awaiter(this, void 0, void 0, function* () {
            while (next < list.length) {
                const i = next++;
                out[i] = yield fn(list[i]);
            }
        });
        yield Promise.all(Array.from({ length: Math.min(size, list.length) }, worker));
        return out;
    });
}
let ETHAdminSearchController = class ETHAdminSearchController {
    /**
     * GET /admin/search?q=&limit=5
     *
     * One query over every collection the user may list whose list view
     * declares `search`, for the command palette: `{ results: [{ collection,
     * label, items: [{ id, title, subtitle? }] }] }`, collections with a match
     * only, in menu registration order. Secrets are neither searched nor sent.
     */
    search(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const adminLeaf = getAdminLeaf();
            if (!adminLeaf || !(yield adminLeaf.canAccessAdmin(req.user))) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 403, errors: ['forbidden'] });
            }
            const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
            if (!q) {
                return (_d = (_c = res).success) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 200, data: { results: [] } });
            }
            const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 20);
            const candidates = adminLeaf.collections.filter((c) => { var _a, _b, _c, _d, _e; return ((_a = c.crud) === null || _a === void 0 ? void 0 : _a.includes('list')) && ((_e = (_d = (_c = (_b = c.views) === null || _b === void 0 ? void 0 : _b.list) === null || _c === void 0 ? void 0 : _c.search) === null || _d === void 0 ? void 0 : _d.length) !== null && _e !== void 0 ? _e : 0) > 0; });
            const allowed = yield Promise.all(candidates.map((c) => adminLeaf.checkAccess(req.user, c.name, 'list')));
            const searchable = candidates.filter((_, i) => allowed[i]);
            const found = yield mapPool(searchable, CONCURRENCY, (collection) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                try {
                    return yield searchCollection(collection, q, limit);
                }
                catch (err) {
                    // One collection whose search columns cannot be matched as text
                    // (a JSON column…) must not take the whole palette down with it.
                    console.error(`[ETHAdminLeaf] Global search error for ${collection.name}:`, (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err);
                    return [];
                }
            }));
            const results = searchable
                .map((collection, i) => {
                var _a, _b;
                return ({
                    collection: collection.name,
                    label: ((_a = collection.meta) === null || _a === void 0 ? void 0 : _a.labelPlural) || ((_b = collection.meta) === null || _b === void 0 ? void 0 : _b.label) || collection.name,
                    items: found[i],
                });
            })
                .filter((group) => group.items.length > 0);
            return (_f = (_e = res).success) === null || _f === void 0 ? void 0 : _f.call(_e, { status: 200, data: { results } });
        });
    }
};
__decorate([
    Get('/admin/search'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAdminSearchController.prototype, "search", null);
ETHAdminSearchController = __decorate([
    Controller()
], ETHAdminSearchController);
export default ETHAdminSearchController;
export const AvailableRouteMethods = ['search'];
