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
import { CaseCannedReply } from '../models/CaseCannedReply.js';
import { attachmentFolders, caseModels, projectModel, customersOf, staffNameOf } from './options.js';
import { CaseStatus, FINISHED_STATUSES } from './statuses.js';
// ──────────────────────────────────────────────────────────────────────────
// What can happen to a case, for the project's app routes and the leaf's
// back-office alike. The checks that answer the caller (is it theirs, is it
// still open) stay with the caller: each answers in its own words.
// ──────────────────────────────────────────────────────────────────────────
/** Opens a case. The hooks stamp its reference and start its clocks. */
export function openCase(draft_1) {
    return __awaiter(this, arguments, void 0, function* (draft, options = {}) {
        const { Case } = caseModels();
        return Case.create(Object.assign({ channel: 'APP' }, draft), options);
    });
}
/**
 * Staff answer: a reply the customer is told of, or an internal note. With
 * `status`, the case moves in the same go; resolving or closing it tells the
 * customer once, not twice.
 */
export function replyToCase(kase, message) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const { CaseComment } = caseModels();
        const internal = !!message.internal;
        const status = message.status && message.status !== kase.status ? message.status : null;
        const comment = yield CaseComment.create({
            case_id: kase.id,
            author_kind: 'staff',
            author_user_id: (_b = (_a = message.author) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null,
            author_name: staffNameOf(message.author),
            body: message.body,
            internal,
            attachments: (_c = message.attachments) !== null && _c !== void 0 ? _c : [],
        }, { notify: !(status && FINISHED_STATUSES.includes(status)) });
        if (status) {
            yield kase.reload();
            yield kase.update({ status });
        }
        return comment;
    });
}
/**
 * The customer says whether the resolution fixed it: closed, or back in
 * progress (`note` then says what is still wrong). Call it on a case that
 * `awaitsConfirmation`. The customer is not told of their own answer.
 */
export function confirmResolution(kase, answer) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const now = new Date();
        const values = answer.fixed
            ? { status: CaseStatus.CLOSED, confirmation_status: 'CONFIRMED', confirmation_note: answer.note || null, confirmation_at: now, last_activity_at: now }
            : {
                status: CaseStatus.IN_PROGRESS,
                confirmation_status: 'REJECTED',
                confirmation_note: answer.note,
                confirmation_at: now,
                reopened_count: ((_a = kase.reopened_count) !== null && _a !== void 0 ? _a : 0) + 1,
                last_activity_at: now,
            };
        return kase.update(values, { notify: false });
    });
}
/** The customer's rating of a resolved or closed case. */
export function rateCase(kase, rating) {
    return __awaiter(this, void 0, void 0, function* () {
        return kase.update({ satisfaction_rating: rating.rating, satisfaction_note: rating.note || null }, { notify: false });
    });
}
/**
 * The files a staff member uploaded through the back-office (ETHMediaLeaf),
 * as a message's attachments: theirs, confirmed, in a case folder and public.
 * Throws on any other.
 */
export function attachmentsFromMedia(staffId, mediaIds) {
    return __awaiter(this, void 0, void 0, function* () {
        const ids = [...new Set((Array.isArray(mediaIds) ? mediaIds : []).map(Number))].filter((id) => Number.isInteger(id) && id > 0);
        if (!ids.length)
            return [];
        const mediaLeaf = etherial.eth_media_leaf;
        const Media = projectModel('Media');
        if (!mediaLeaf || !Media)
            throw new Error('Files cannot be added: the media module is missing.');
        const rows = yield Media.findAll({ where: { id: { [Op.in]: ids }, uploaded_by: staffId, status: 'uploaded', folder: { [Op.in]: attachmentFolders() } } });
        const byId = new Map(rows.map((row) => [row.id, row]));
        return ids.map((id) => {
            var _a, _b;
            const media = byId.get(id);
            const url = media ? mediaLeaf.getPublicUrl(media) : null;
            if (!media || !url)
                throw new Error('A file is missing or not uploaded yet. Add it again.');
            return { id: media.id, url, filename: (_a = media.real_name) !== null && _a !== void 0 ? _a : null, content_type: (_b = media.mime_type) !== null && _b !== void 0 ? _b : null };
        });
    });
}
/** A canned reply's text for this case: `{{customer_name}}`, `{{reference}}`, `{{subject}}`, `{{staff_name}}`. */
export function renderCannedReply(body, kase, customer, staff) {
    var _a, _b;
    const first = (user) => { var _a, _b; return String((_b = (_a = user === null || user === void 0 ? void 0 : user.first_name) !== null && _a !== void 0 ? _a : user === null || user === void 0 ? void 0 : user.firstname) !== null && _b !== void 0 ? _b : '').trim(); };
    const values = {
        customer_name: first(customer),
        reference: (_a = kase.reference) !== null && _a !== void 0 ? _a : '',
        subject: (_b = kase.subject) !== null && _b !== void 0 ? _b : '',
        staff_name: staffNameOf(staff),
    };
    return body
        .replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => (key in values ? values[key] : match))
        .replace(/[ \t]+([,.!?])/g, '$1');
}
/** The active canned replies for a case of this kind, most used first. */
export function cannedRepliesFor(kase, staff) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const rows = yield CaseCannedReply.findAll({
            where: { active: true, [Op.or]: [{ kind: null }, { kind: kase.kind }] },
            order: [
                ['used_count', 'DESC'],
                ['title', 'ASC'],
            ],
            limit: 100,
        });
        const customer = kase.user_id ? yield ((_a = projectModel(customersOf().model)) === null || _a === void 0 ? void 0 : _a.findByPk(kase.user_id)) : null;
        return rows.map((row) => ({ id: row.id, title: row.title, body: renderCannedReply(row.body, kase, customer, staff) }));
    });
}
/** The Media ids the cases and their messages keep in JSON, for ETHMediaLeaf's orphan cleanup. */
export function caseMediaIds() {
    return __awaiter(this, void 0, void 0, function* () {
        const { Case, CaseComment } = caseModels();
        const ids = [];
        const add = (list) => {
            for (const file of Array.isArray(list) ? list : [])
                if (file && typeof file === 'object' && Number.isInteger(file.id))
                    ids.push(file.id);
        };
        for (const row of yield Case.findAll({ attributes: ['attachments', 'issues'], raw: true })) {
            add(row.attachments);
            for (const issue of Array.isArray(row.issues) ? row.issues : [])
                add(issue === null || issue === void 0 ? void 0 : issue.photos);
        }
        for (const row of yield CaseComment.findAll({ attributes: ['attachments'], raw: true }))
            add(row.attachments);
        return ids;
    });
}
