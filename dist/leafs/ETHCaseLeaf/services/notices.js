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
import { currentActor } from '../../ETHAdminLeaf/features/audit.js';
import { CASES_COLLECTION, alertOn, state } from './options.js';
/**
 * Tells the customer through the project's `notify`. Awaited, as the project
 * may expect its notification written once the write returns; its failure
 * only prints.
 */
export function notifyCustomer(kase, kind, comment) {
    return __awaiter(this, void 0, void 0, function* () {
        const notify = state.config.notify;
        if (!notify || !(kase === null || kase === void 0 ? void 0 : kase.user_id))
            return;
        try {
            yield notify({ kind, case: kase, comment });
        }
        catch (error) {
            console.error(`[ETHCaseLeaf] Could not tell the customer of case #${kase.id} (${kind}):`, (error === null || error === void 0 ? void 0 : error.message) || error);
        }
    });
}
const nameOf = (kase) => kase.reference || `Case #${kase.id}`;
const excerpt = (text, length = 140) => {
    const flat = String(text !== null && text !== void 0 ? text : '').replace(/\s+/g, ' ').trim();
    if (!flat)
        return undefined;
    return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
};
/**
 * A line in the staff's bell (ETHAdminLeaf), in the background: to the
 * assignee when there is one and `assignee` is asked, else to whoever may
 * change cases. The person who did it is never told.
 */
export function alertStaff(kind, kase, message) {
    var _a, _b, _c;
    const adminLeaf = etherial.eth_admin_leaf;
    if (!alertOn(kind) || !(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.notify) || ((_a = adminLeaf.notificationsEnabled) === null || _a === void 0 ? void 0 : _a.call(adminLeaf)) === false)
        return;
    const { actor } = currentActor();
    const actorId = actor.type === 'user' ? ((_b = actor.id) !== null && _b !== void 0 ? _b : undefined) : undefined;
    const to = ((_c = message.userIds) === null || _c === void 0 ? void 0 : _c.length)
        ? { userIds: message.userIds }
        : message.assignee && kase.assigned_to_user_id
            ? { userIds: [kase.assigned_to_user_id] }
            : { permission: { collection: CASES_COLLECTION, permission: 'update' } };
    adminLeaf
        .notify({
        to,
        type: message.type,
        title: message.title,
        body: excerpt(message.body),
        link: `/${CASES_COLLECTION}/${kase.id}`,
        collection: CASES_COLLECTION,
        recordId: kase.id,
        actorId,
    })
        .catch((error) => console.error(`[ETHCaseLeaf] Could not alert staff on case #${kase.id} (${message.type}):`, (error === null || error === void 0 ? void 0 : error.message) || error));
}
export const caseTitle = {
    created: (kase) => `New: ${nameOf(kase)}`,
    reply: (kase) => `${nameOf(kase)}: the customer answered`,
    rejected: (kase) => `${nameOf(kase)}: the customer says it is not fixed`,
    assigned: (kase) => `${nameOf(kase)} is assigned to you`,
    overdue: (kase) => `${nameOf(kase)} is overdue`,
};
export { excerpt };
