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
import { REQUESTS_COLLECTION } from './options.js';
import { state } from './state.js';
/** Whoever may list what was asked may ask, unless the project says otherwise. */
export function mayUse(user) {
    return __awaiter(this, void 0, void 0, function* () {
        const adminLeaf = etherial.eth_admin_leaf;
        if (!adminLeaf || !(yield adminLeaf.canAccessAdmin(user)))
            return false;
        if (state.config.canUse)
            return !!(yield state.config.canUse(user));
        return !!(yield adminLeaf.checkAccess(user, REQUESTS_COLLECTION, 'list'));
    });
}
