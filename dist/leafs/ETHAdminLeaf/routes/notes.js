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
import { Controller, Get, Post, Put, Delete } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { AdminNote } from '../models/AdminNote.js';
import { userIdOf } from '../features/notifications.js';
import { NOTE_MAX_LENGTH, canDeleteNote, canUseNotes, createNote, listNotes, mentionableUsers, serializeNotes, updateNote, } from '../features/notes.js';
const getAdminLeaf = () => etherial.eth_admin_leaf;
/** The body as sent, or the error code it earns. */
function bodyOf(req) {
    var _a;
    const raw = (_a = req.body) === null || _a === void 0 ? void 0 : _a.body;
    if (typeof raw !== 'string' || !raw.trim())
        return { error: 'body_required' };
    if (raw.length > NOTE_MAX_LENGTH)
        return { error: 'body_too_long' };
    return { body: raw.trim() };
}
let ETHAdminNotesController = class ETHAdminNotesController {
    /**
     * GET /admin/notes/mentionable?collection=orders&q=sa
     *
     * Who can be mentioned on this collection's records: staff who may see it.
     */
    mentionable(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const collection = String((_a = req.query.collection) !== null && _a !== void 0 ? _a : '');
            if (!(yield canUseNotes(req.user, collection))) {
                return res.error({ status: 403, errors: ['forbidden'] });
            }
            const items = yield mentionableUsers(collection, String((_b = req.query.q) !== null && _b !== void 0 ? _b : ''), userIdOf(req.user));
            return res.success({ status: 200, data: { items } });
        });
    }
    /** GET /admin/notes/:collection/:id: the record's notes, oldest first. */
    list(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { collection, id } = req.params;
            if (!(yield canUseNotes(req.user, collection))) {
                return res.error({ status: 403, errors: ['forbidden'] });
            }
            const notes = yield listNotes(collection, String(id));
            return res.success({ status: 200, data: { items: yield serializeNotes(notes, req.user) } });
        });
    }
    /** POST /admin/notes/:collection/:id  body `{ body }` */
    create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { collection, id } = req.params;
            if (!(yield canUseNotes(req.user, collection))) {
                return res.error({ status: 403, errors: ['forbidden'] });
            }
            if (userIdOf(req.user) === null) {
                return res.error({ status: 403, errors: ['forbidden'] });
            }
            const parsed = bodyOf(req);
            if ('error' in parsed) {
                return res.error({ status: 400, errors: [parsed.error] });
            }
            // A note on a record that does not exist would never be seen again.
            const model = (_b = (_a = getAdminLeaf()) === null || _a === void 0 ? void 0 : _a.getCollection(collection)) === null || _b === void 0 ? void 0 : _b.model;
            if (model && !(yield model.findByPk(id))) {
                return res.error({ status: 404, errors: ['not_found'] });
            }
            const note = yield createNote(collection, String(id), parsed.body, req.user);
            const [item] = yield serializeNotes([note], req.user);
            return res.success({ status: 201, data: item });
        });
    }
    /** PUT /admin/notes/item/:noteId  body `{ body }`: the author only. */
    update(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const note = yield AdminNote.findByPk(Number(req.params.noteId) || 0);
            if (!note || !(yield canUseNotes(req.user, note.collection))) {
                return res.error({ status: 404, errors: ['not_found'] });
            }
            if (note.author_id !== userIdOf(req.user)) {
                return res.error({ status: 403, errors: ['not_author'] });
            }
            const parsed = bodyOf(req);
            if ('error' in parsed) {
                return res.error({ status: 400, errors: [parsed.error] });
            }
            yield updateNote(note, parsed.body, req.user);
            const [item] = yield serializeNotes([note], req.user);
            return res.success({ status: 200, data: item });
        });
    }
    /** DELETE /admin/notes/item/:noteId: the author, or a super admin. */
    remove(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const note = yield AdminNote.findByPk(Number(req.params.noteId) || 0);
            if (!note || !(yield canUseNotes(req.user, note.collection))) {
                return res.error({ status: 404, errors: ['not_found'] });
            }
            if (!(yield canDeleteNote(note, req.user))) {
                return res.error({ status: 403, errors: ['forbidden'] });
            }
            yield note.destroy();
            return res.success({ status: 200, data: { id: note.id } });
        });
    }
};
__decorate([
    Get('/admin/notes/mentionable'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAdminNotesController.prototype, "mentionable", null);
__decorate([
    Get('/admin/notes/:collection/:id'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAdminNotesController.prototype, "list", null);
__decorate([
    Post('/admin/notes/:collection/:id'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAdminNotesController.prototype, "create", null);
__decorate([
    Put('/admin/notes/item/:noteId'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAdminNotesController.prototype, "update", null);
__decorate([
    Delete('/admin/notes/item/:noteId'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAdminNotesController.prototype, "remove", null);
ETHAdminNotesController = __decorate([
    Controller()
], ETHAdminNotesController);
export default ETHAdminNotesController;
