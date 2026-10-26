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
import { languageOf } from './options.js';
import { languages, state } from './state.js';
/**
 * The app's language: `?locale=`, then the app's header, then the phone's,
 * among the languages the app gets. Else the default one.
 */
export function localeOf(req) {
    var _a, _b;
    const { app, default: fallback } = languages();
    const asked = [(_a = req.query) === null || _a === void 0 ? void 0 : _a.locale, req.headers['x-app-locale'], req.headers['accept-language']].map(languageOf);
    return (_b = asked.find((l) => !!l && app.includes(l))) !== null && _b !== void 0 ? _b : fallback;
}
/**
 * Whether the request comes from someone signed in: the project's own check,
 * else a token etherial's auth accepts (signature, expiry, its user).
 */
export function isSignedIn(req) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            if (state.config.signedIn)
                return !!(yield state.config.signedIn(req));
            const header = req.headers.authorization;
            const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7).trim() : '';
            if (!token)
                return false;
            return !!(yield ((_b = (_a = etherial.http_auth) === null || _a === void 0 ? void 0 : _a.userFromToken) === null || _b === void 0 ? void 0 : _b.call(_a, token)));
        }
        catch (_c) {
            return false;
        }
    });
}
