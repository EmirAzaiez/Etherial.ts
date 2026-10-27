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
import { COLLECTION, PageError, defaultLocaleOf, languageOf } from './options.js';
import { state } from './state.js';
/** The app's language: `?locale=`, then the app's header, then the phone's. */
export function localeOf(req) {
    var _a, _b, _c, _d;
    return ((_d = (_c = (_b = languageOf((_a = req.query) === null || _a === void 0 ? void 0 : _a.locale)) !== null && _b !== void 0 ? _b : languageOf(req.headers['x-app-locale'])) !== null && _c !== void 0 ? _c : languageOf(req.headers['accept-language'])) !== null && _d !== void 0 ? _d : defaultLocaleOf(state.config));
}
/** A back-office route, once the admin leaf allows it: by default, to whoever may read the pages. */
export function guard(req_1, res_1, run_1) {
    return __awaiter(this, arguments, void 0, function* (req, res, run, may = (adminLeaf) => adminLeaf.checkAccess(req.user, COLLECTION, 'list')) {
        const adminLeaf = etherial.eth_admin_leaf;
        const allowed = !!adminLeaf && (yield adminLeaf.canAccessAdmin(req.user)) && (yield may(adminLeaf));
        if (!allowed)
            return res.error({ status: 403, errors: ['forbidden'] });
        try {
            return res.success({ status: 200, data: yield run() });
        }
        catch (err) {
            if (err instanceof PageError)
                return res.error({ status: err.status, errors: [err.message], message: err.message });
            console.error('[ETHPageLeaf] Admin route failed:', err);
            return res.error({ status: 500, errors: ['server_error'] });
        }
    });
}
/**
 * A back-office route that answers as it goes, in server-sent events (`event:
 * <name>` / `data: <json>`): `run` sends them. A failure before the first one
 * is answered like `guard`'s; after it, as an `error` event. The run is
 * stopped (`signal`) when the back-office goes away.
 */
export function streamed(req, res, run) {
    return __awaiter(this, void 0, void 0, function* () {
        const adminLeaf = etherial.eth_admin_leaf;
        if (!adminLeaf || !(yield adminLeaf.canAccessAdmin(req.user)))
            return res.error({ status: 403, errors: ['forbidden'] });
        const controller = new AbortController();
        res.on('close', () => {
            if (!res.writableFinished)
                controller.abort();
        });
        let ping;
        const send = (event, data) => {
            if (controller.signal.aborted)
                return;
            if (!res.headersSent) {
                res.status(200);
                res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache, no-transform');
                res.setHeader('X-Accel-Buffering', 'no');
                res.flushHeaders();
                // A proxy closes a connection that says nothing for a while: Claude can think for some time.
                ping = setInterval(() => res.write(': ping\n\n'), 10000);
            }
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        };
        try {
            yield run(send, controller.signal);
        }
        catch (err) {
            if (controller.signal.aborted)
                return;
            const known = err instanceof PageError;
            if (!known)
                console.error('[ETHPageLeaf] Streamed route failed:', err);
            const status = known ? err.status : 500;
            const message = known ? err.message : 'server_error';
            if (!res.headersSent)
                return res.error({ status, errors: [message], message });
            send('error', { status, message });
        }
        finally {
            clearInterval(ping);
            if (res.headersSent && !res.writableEnded)
                res.end();
        }
    });
}
