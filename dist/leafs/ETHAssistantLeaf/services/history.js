// ──────────────────────────────────────────────────────────────────────────
// Each person's conversations, with the leaf's `history` on: every answered
// turn is added to the conversation it belongs to, and what the person then
// decided on a proposed change is written beside it. Everything here is
// scoped by the owner's id: nobody reads, renames or deletes another's.
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
import { Op } from 'sequelize';
import { AssistantConversation } from '../models/AssistantConversation.js';
import { keepDaysOf } from './options.js';
import { state } from './state.js';
/** Past this, the oldest turns go: the model reads the last few anyway. */
const MAX_TURNS = 100;
const MAX_LISTED = 100;
const MAX_TITLE = 200;
const PURGE_EVERY = 3600 * 1000;
export const DECISIONS = ['confirmed', 'cancelled', 'failed'];
const ownedBy = (userId, id) => ({ id: Number(id), user_id: userId });
function titleOf(input, where) {
    var _a, _b, _c;
    const prompt = (_c = (_b = (_a = [...input.messages].reverse().find((m) => m.role === 'user')) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : '';
    const base = input.task === 'summarize' ? `Summary${where ? ` of ${where}` : ''}` : input.task === 'draft' ? `Drafted reply${where ? ` for ${where}` : ''}` : prompt;
    const title = (base || 'Conversation').replace(/\s+/g, ' ');
    return title.length > 80 ? `${title.slice(0, 80)}…` : title;
}
let lastPurge = 0;
/** Conversations left alone past `keepDays`, deleted at most once an hour, by whichever server saves one. */
function purgeOld() {
    return __awaiter(this, void 0, void 0, function* () {
        const days = keepDaysOf(state.config);
        if (!days || Date.now() - lastPurge < PURGE_EVERY)
            return;
        lastPurge = Date.now();
        try {
            yield AssistantConversation.destroy({ where: { updated_at: { [Op.lt]: new Date(Date.now() - days * 24 * 3600 * 1000) } } });
        }
        catch (err) {
            console.error('[ETHAssistantLeaf] Could not purge old conversations:', (err === null || err === void 0 ? void 0 : err.message) || err);
        }
    });
}
/**
 * Adds an answered turn to the person's conversation — a new one when none is
 * named, or when the one named is not theirs (or no longer exists). Returns
 * its id; null when it could not be saved, which never fails the answer.
 */
export function saveTurn(userId, input, output, conversationId, where) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const turn = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ id: `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, task: input.task, prompt: (_b = (_a = [...input.messages].reverse().find((m) => m.role === 'user')) === null || _a === void 0 ? void 0 : _a.content) !== null && _b !== void 0 ? _b : '' }, (input.context ? { context: input.context } : {})), (where ? { where } : {})), (input.language ? { language: input.language } : {})), { answer: { answer: output.answer, steps: output.steps, model: output.model } }), (((_c = output.proposals) === null || _c === void 0 ? void 0 : _c.length) ? { proposals: output.proposals } : {})), { at: new Date().toISOString() });
        try {
            const existing = conversationId ? yield AssistantConversation.findOne({ where: ownedBy(userId, conversationId) }) : null;
            if (existing) {
                const turns = [...(Array.isArray(existing.turns) ? existing.turns : []), turn].slice(-MAX_TURNS);
                yield existing.update({ turns });
                return existing.id;
            }
            const created = yield AssistantConversation.create({ user_id: userId, title: titleOf(input, where), turns: [turn] });
            void purgeOld();
            return created.id;
        }
        catch (err) {
            console.error('[ETHAssistantLeaf] Could not save a conversation:', (err === null || err === void 0 ? void 0 : err.message) || err);
            return null;
        }
    });
}
export function listConversations(userId, search) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const where = { user_id: userId };
        if (search) {
            const like = ((_a = AssistantConversation.sequelize) === null || _a === void 0 ? void 0 : _a.getDialect()) === 'postgres' ? Op.iLike : Op.like;
            where.title = { [like]: `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%` };
        }
        const rows = yield AssistantConversation.findAll({
            where,
            order: [['updated_at', 'DESC']],
            limit: MAX_LISTED,
        });
        return rows.map((row) => ({
            id: row.id,
            title: row.title,
            turns: Array.isArray(row.turns) ? row.turns.length : 0,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }));
    });
}
export function getConversation(userId, id) {
    return __awaiter(this, void 0, void 0, function* () {
        const row = yield AssistantConversation.findOne({ where: ownedBy(userId, id) });
        if (!row)
            return null;
        return { id: row.id, title: row.title, turns: Array.isArray(row.turns) ? row.turns : [], created_at: row.created_at, updated_at: row.updated_at };
    });
}
export function renameConversation(userId, id, title) {
    return __awaiter(this, void 0, void 0, function* () {
        const [count] = yield AssistantConversation.update({ title: title.slice(0, MAX_TITLE) }, { where: ownedBy(userId, id) });
        return count > 0;
    });
}
export function deleteConversation(userId, id) {
    return __awaiter(this, void 0, void 0, function* () {
        return (yield AssistantConversation.destroy({ where: ownedBy(userId, id) })) > 0;
    });
}
/** What the person decided on one proposal; false when no such proposal is theirs. */
export function recordDecision(userId, id, proposalId, decision) {
    return __awaiter(this, void 0, void 0, function* () {
        const row = yield AssistantConversation.findOne({ where: ownedBy(userId, id) });
        if (!row || !Array.isArray(row.turns))
            return false;
        let found = false;
        const turns = row.turns.map((turn) => {
            var _a;
            if (!((_a = turn === null || turn === void 0 ? void 0 : turn.proposals) === null || _a === void 0 ? void 0 : _a.some((p) => p.id === proposalId)))
                return turn;
            found = true;
            return Object.assign(Object.assign({}, turn), { proposals: turn.proposals.map((p) => p.id === proposalId
                    ? Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, p), { status: decision.status }), (decision.error ? { error: decision.error.slice(0, 500) } : {})), (decision.createdId !== undefined ? { createdId: decision.createdId } : {})), { decidedAt: new Date().toISOString() }) : p) });
        });
        if (!found)
            return false;
        yield row.update({ turns });
        return true;
    });
}
