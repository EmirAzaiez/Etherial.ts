// ──────────────────────────────────────────────────────────────────────────
// Internal notes on records.
//
// Staff leave a word on a record ("called him, he'll send the papers Monday")
// and can pull a colleague in with a mention, written in the body as
// `@[Sara Ali](user:12)`: the text keeps the name it was written with, so a
// note still reads right after a rename, and the id is what gets notified.
//
// A note is as visible as its record: reading or writing one needs `show` on
// the collection, and only people who can see the collection can be
// mentioned, or a mention would leak a record to someone who may not open it.
// Only the author edits a note; the author or a super admin deletes it.
// ──────────────────────────────────────────────────────────────────────────
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
import { AdminNote } from '../models/AdminNote.js';
import { adminUserLabel, listAdminUsers, loadUsers, notifyAdmins, userIdOf } from './notifications.js';
export const MENTION = /@\[([^\]\n]{1,120})\]\(user:(\d+)\)/g;
export const NOTE_MAX_LENGTH = 10000;
function adminLeaf() {
    var _a;
    return (_a = etherial.eth_admin_leaf) !== null && _a !== void 0 ? _a : null;
}
/** The user ids a body mentions, in order, once each. */
export function parseMentions(body) {
    const ids = [];
    for (const match of String(body !== null && body !== void 0 ? body : '').matchAll(MENTION)) {
        const id = Number(match[2]);
        if (Number.isInteger(id) && !ids.includes(id))
            ids.push(id);
    }
    return ids;
}
/** The body as an email or the bell shows it: `@Sara Ali` rather than the markup. */
export function plainNote(body) {
    return String(body !== null && body !== void 0 ? body : '').replace(MENTION, (_all, name) => `@${name}`);
}
/** Whether this person may read and write notes on this collection's records. */
export function canUseNotes(user, collection) {
    return __awaiter(this, void 0, void 0, function* () {
        const leaf = adminLeaf();
        if (!leaf || !collection || !leaf.getCollection(collection))
            return false;
        const check = typeof leaf.canAccess === 'function' ? leaf.canAccess : leaf.checkAccess;
        return !!(yield check.call(leaf, user, collection, 'show'));
    });
}
function isSuperAdmin(user) {
    return __awaiter(this, void 0, void 0, function* () {
        const leaf = adminLeaf();
        if (typeof (leaf === null || leaf === void 0 ? void 0 : leaf.isSuperAdmin) !== 'function')
            return false;
        return !!(yield leaf.isSuperAdmin(user));
    });
}
/**
 * Staff who can see the collection, for the mention picker: matched on name
 * or email, at most `limit`, the asker left out.
 */
export function mentionableUsers(collection_1, query_1, exceptId_1) {
    return __awaiter(this, arguments, void 0, function* (collection, query, exceptId, limit = 10) {
        const q = String(query !== null && query !== void 0 ? query : '').trim().toLowerCase();
        const users = yield listAdminUsers({ collection, permission: 'view' });
        const items = [];
        for (const user of users) {
            const id = userIdOf(user);
            if (id === null || id === exceptId)
                continue;
            const name = adminUserLabel(user);
            const email = typeof (user === null || user === void 0 ? void 0 : user.get) === 'function' ? user.get('email') : user === null || user === void 0 ? void 0 : user.email;
            if (q && !name.toLowerCase().includes(q) && !String(email !== null && email !== void 0 ? email : '').toLowerCase().includes(q))
                continue;
            items.push(email ? { id, name, email: String(email) } : { id, name });
            if (items.length >= limit)
                break;
        }
        return items;
    });
}
/**
 * Keeps the mentions of people who can see the collection. Each one is
 * checked on its own rather than against the picker's list, so a mention
 * typed by hand is held to the same rule.
 */
function allowedMentions(ids, collection) {
    return __awaiter(this, void 0, void 0, function* () {
        const leaf = adminLeaf();
        if (!ids.length || !leaf)
            return [];
        const users = yield loadUsers(ids);
        const allowed = [];
        for (const id of ids) {
            const user = users.get(id);
            if (!user)
                continue;
            if (!(yield leaf.canAccessAdmin(user)))
                continue;
            if (!(yield canUseNotes(user, collection)))
                continue;
            allowed.push(id);
        }
        return allowed;
    });
}
export function serializeNotes(notes, viewer) {
    return __awaiter(this, void 0, void 0, function* () {
        const viewerId = userIdOf(viewer);
        const superAdmin = yield isSuperAdmin(viewer);
        const authors = yield loadUsers(notes.map((note) => note.author_id));
        return notes.map((note) => {
            var _a;
            const author = authors.get(note.author_id);
            const own = viewerId !== null && note.author_id === viewerId;
            return {
                id: note.id,
                body: note.body,
                mentions: Array.isArray(note.mentions) ? note.mentions : [],
                author: author ? { id: note.author_id, name: adminUserLabel(author) } : { id: note.author_id, name: `#${note.author_id}` },
                created_at: note.created_at,
                updated_at: note.updated_at,
                edited_at: (_a = note.edited_at) !== null && _a !== void 0 ? _a : null,
                can_edit: own,
                can_delete: own || superAdmin,
            };
        });
    });
}
export function listNotes(collection, recordId) {
    return __awaiter(this, void 0, void 0, function* () {
        return AdminNote.findAll({
            where: { collection, record_id: recordId },
            order: [['id', 'ASC']],
            limit: 500,
        });
    });
}
function notifyMentions(note, ids, author) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!ids.length)
            return;
        const leaf = adminLeaf();
        const config = leaf === null || leaf === void 0 ? void 0 : leaf.getCollection(note.collection);
        const label = ((_a = config === null || config === void 0 ? void 0 : config.meta) === null || _a === void 0 ? void 0 : _a.label) || note.collection;
        const text = plainNote(note.body);
        yield notifyAdmins({
            to: { userIds: ids },
            type: 'mention',
            title: `${adminUserLabel(author)} mentioned you on ${label} #${note.record_id}`,
            body: text.length > 280 ? `${text.slice(0, 277)}…` : text,
            link: `/${note.collection}/${encodeURIComponent(note.record_id)}`,
            collection: note.collection,
            recordId: note.record_id,
            actorId: userIdOf(author),
            data: { noteId: note.id },
            email: true,
        });
    });
}
/** A failed notification must not lose the note that was just saved. */
function notifyQuietly(note, ids, author) {
    notifyMentions(note, ids, author).catch((err) => console.error('[ETHAdminLeaf] Note mentions:', (err === null || err === void 0 ? void 0 : err.message) || err));
}
export function createNote(collection, recordId, body, author) {
    return __awaiter(this, void 0, void 0, function* () {
        const mentions = yield allowedMentions(parseMentions(body), collection);
        const note = yield AdminNote.create({
            collection,
            record_id: recordId,
            author_id: userIdOf(author),
            body,
            mentions,
        });
        notifyQuietly(note, mentions, author);
        return note;
    });
}
/** Only the people mentioned for the first time hear about an edit. */
export function updateNote(note, body, author) {
    return __awaiter(this, void 0, void 0, function* () {
        const before = new Set(Array.isArray(note.mentions) ? note.mentions : []);
        const mentions = yield allowedMentions(parseMentions(body), note.collection);
        yield note.update({ body, mentions, edited_at: new Date() });
        notifyQuietly(note, mentions.filter((id) => !before.has(id)), author);
        return note;
    });
}
export function canDeleteNote(note, user) {
    return __awaiter(this, void 0, void 0, function* () {
        if (note.author_id === userIdOf(user))
            return true;
        return isSuperAdmin(user);
    });
}
