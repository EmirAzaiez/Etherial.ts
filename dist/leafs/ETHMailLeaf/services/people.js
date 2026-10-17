var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { MailTemplate } from '../models/MailTemplate.js';
/**
 * Who saved a version, scheduled a campaign: names for the back-office, read
 * from the project's `User` model with the columns it has. An id it can't
 * name stays out of the map.
 */
export function peopleNames(ids) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const names = new Map();
        const unique = [...new Set(ids.filter((id) => typeof id === 'number'))];
        const User = (_b = (_a = MailTemplate.sequelize) === null || _a === void 0 ? void 0 : _a.models) === null || _b === void 0 ? void 0 : _b.User;
        if (!unique.length || !User)
            return names;
        const columns = ['first_name', 'last_name', 'firstname', 'lastname', 'name', 'email'].filter((c) => { var _a; return c in ((_a = User.rawAttributes) !== null && _a !== void 0 ? _a : {}); });
        try {
            const rows = yield User.findAll({ where: { id: unique }, attributes: ['id', ...columns], raw: true });
            for (const row of rows) {
                const full = [(_c = row.first_name) !== null && _c !== void 0 ? _c : row.firstname, (_d = row.last_name) !== null && _d !== void 0 ? _d : row.lastname].filter(Boolean).join(' ').trim();
                const label = full || row.name || row.email;
                if (label)
                    names.set(row.id, String(label));
            }
        }
        catch (err) {
            console.error('[ETHMailLeaf] Could not read the users’ names:', (err === null || err === void 0 ? void 0 : err.message) || err);
        }
        return names;
    });
}
/** `{ id, name }`, or null without an id. */
export function person(id, names) {
    var _a;
    return typeof id === 'number' ? { id, name: (_a = names.get(id)) !== null && _a !== void 0 ? _a : null } : null;
}
