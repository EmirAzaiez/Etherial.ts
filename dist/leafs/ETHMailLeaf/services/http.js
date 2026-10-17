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
import { MailError } from './options.js';
/**
 * Runs a back-office route once the admin leaf allows it: reading takes the
 * collection's `list` right, changing it the one named.
 */
export function guard(req, res, collection, method, run) {
    return __awaiter(this, void 0, void 0, function* () {
        const adminLeaf = etherial.eth_admin_leaf;
        const allowed = !!adminLeaf && (yield adminLeaf.canAccessAdmin(req.user)) && (yield adminLeaf.checkAccess(req.user, collection, method));
        if (!allowed)
            return res.error({ status: 403, errors: ['forbidden'] });
        try {
            return res.success({ status: 200, data: yield run() });
        }
        catch (err) {
            if (err instanceof MailError)
                return res.error({ status: err.status, errors: [err.code], message: err.message });
            console.error('[ETHMailLeaf] Admin route failed:', err);
            return res.error({ status: 500, errors: ['server_error'] });
        }
    });
}
/** The address the back-office reached the API at: `https://api.example.com`. HTTPS unless it is this machine. */
export function originOf(req) {
    var _a;
    const host = ((_a = req.get('x-forwarded-host')) === null || _a === void 0 ? void 0 : _a.split(',')[0].trim()) || req.get('host');
    if (!host || !/^[a-z0-9.\-:[\]]+$/i.test(host))
        return null;
    const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
    return `${local ? req.protocol : 'https'}://${host}`;
}
