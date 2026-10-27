var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import { AGENT_NAME, PageError } from './options.js';
const API_VERSION = '2026-10-21';
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 529]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** The answer, streamed into `onText`. Retried only while nothing has been written yet. */
export function streamMessage(request) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const base = (request.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
        const body = JSON.stringify(Object.assign(Object.assign({ model: request.model, max_tokens: request.maxTokens, stream: true, system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }], messages: [
                {
                    role: 'user',
                    content: ((_a = request.documents) === null || _a === void 0 ? void 0 : _a.length) || ((_b = request.images) === null || _b === void 0 ? void 0 : _b.length)
                        ? [
                            ...((_c = request.documents) !== null && _c !== void 0 ? _c : []).map((doc) => ({
                                type: 'document',
                                source: { type: 'base64', media_type: 'application/pdf', data: doc.data },
                                title: doc.name,
                            })),
                            ...((_d = request.images) !== null && _d !== void 0 ? _d : []).map((image) => ({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } })),
                            { type: 'text', text: request.prompt },
                        ]
                        : request.prompt,
                },
            ] }, (request.effort ? { output_config: { effort: request.effort } } : {})), (request.fallbacks ? { fallbacks: 'default' } : {})));
        const headers = Object.assign({ 'content-type': 'application/json', 'x-api-key': request.apiKey, 'anthropic-version': API_VERSION }, (request.fallbacks ? { 'anthropic-beta': FALLBACK_BETA } : {}));
        let lastError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt)
                yield sleep(1000 * attempt);
            if ((_e = request.signal) === null || _e === void 0 ? void 0 : _e.aborted)
                throw new PageError('Stopped.', 499);
            let response;
            try {
                response = yield fetch(`${base}/v1/messages`, { method: 'POST', headers, body, signal: request.signal });
            }
            catch (err) {
                if ((err === null || err === void 0 ? void 0 : err.name) === 'AbortError')
                    throw new PageError('Stopped.', 499);
                lastError = new PageError(`Could not reach ${AGENT_NAME}. Try again in a moment.`, 502);
                continue;
            }
            if (response.ok && response.body)
                return read(response.body, request);
            const text = yield response.text().catch(() => '');
            let detail = `HTTP ${response.status}`;
            try {
                const message = (_g = (_f = JSON.parse(text)) === null || _f === void 0 ? void 0 : _f.error) === null || _g === void 0 ? void 0 : _g.message;
                if (message)
                    detail = String(message).slice(0, 200);
            }
            catch (_h) {
                // Not JSON: a proxy's error page.
            }
            if (response.status === 401 || response.status === 403)
                throw new PageError(`The Anthropic key was refused: ${detail}`, 502);
            if (!RETRYABLE.has(response.status))
                throw new PageError(`${AGENT_NAME} declined the request: ${detail}`, 502);
            lastError = new PageError(`${AGENT_NAME} is busy. Try again in a moment.`, 503);
        }
        throw lastError !== null && lastError !== void 0 ? lastError : new PageError(`Could not reach ${AGENT_NAME}.`, 502);
    });
}
/** The server-sent events of a streamed message, as they come. */
function read(stream, request) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
        var _d;
        const decoder = new TextDecoder();
        const result = { stopReason: '', model: request.model, usage: { input_tokens: 0, output_tokens: 0 } };
        let buffer = '';
        const handle = (event) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
            switch (event === null || event === void 0 ? void 0 : event.type) {
                case 'message_start': {
                    const usage = (_b = (_a = event.message) === null || _a === void 0 ? void 0 : _a.usage) !== null && _b !== void 0 ? _b : {};
                    result.model = (_d = (_c = event.message) === null || _c === void 0 ? void 0 : _c.model) !== null && _d !== void 0 ? _d : result.model;
                    result.usage.input_tokens = (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0);
                    break;
                }
                case 'content_block_start':
                    if (((_e = event.content_block) === null || _e === void 0 ? void 0 : _e.type) === 'thinking')
                        (_f = request.onThinking) === null || _f === void 0 ? void 0 : _f.call(request);
                    break;
                case 'content_block_delta':
                    if (((_g = event.delta) === null || _g === void 0 ? void 0 : _g.type) === 'text_delta' && event.delta.text)
                        request.onText(event.delta.text);
                    else if (((_h = event.delta) === null || _h === void 0 ? void 0 : _h.type) === 'thinking_delta')
                        (_j = request.onThinking) === null || _j === void 0 ? void 0 : _j.call(request);
                    break;
                case 'message_delta':
                    if ((_k = event.delta) === null || _k === void 0 ? void 0 : _k.stop_reason)
                        result.stopReason = event.delta.stop_reason;
                    if ((_l = event.usage) === null || _l === void 0 ? void 0 : _l.output_tokens)
                        result.usage.output_tokens = event.usage.output_tokens;
                    break;
                case 'error': {
                    const kind = (_m = event.error) === null || _m === void 0 ? void 0 : _m.type;
                    throw new PageError(kind === 'overloaded_error' ? `${AGENT_NAME} is busy. Try again in a moment.` : `${AGENT_NAME} stopped: ${(_q = (_p = (_o = event.error) === null || _o === void 0 ? void 0 : _o.message) !== null && _p !== void 0 ? _p : kind) !== null && _q !== void 0 ? _q : 'error'}`, 503);
                }
            }
        };
        try {
            try {
                for (var _e = true, _f = __asyncValues(stream), _g; _g = yield _f.next(), _a = _g.done, !_a; _e = true) {
                    _c = _g.value;
                    _e = false;
                    const chunk = _c;
                    buffer += decoder.decode(chunk, { stream: true });
                    let end;
                    while ((end = buffer.search(/\r?\n\r?\n/)) >= 0) {
                        const frame = buffer.slice(0, end);
                        buffer = buffer.slice(end).replace(/^\r?\n\r?\n/, '');
                        const data = frame
                            .split(/\r?\n/)
                            .filter((line) => line.startsWith('data:'))
                            .map((line) => line.slice(5).trimStart())
                            .join('\n');
                        if (!data)
                            continue;
                        let event;
                        try {
                            event = JSON.parse(data);
                        }
                        catch (_h) {
                            continue;
                        }
                        handle(event);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_e && !_a && (_b = _f.return)) yield _b.call(_f);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        catch (err) {
            if (err instanceof PageError)
                throw err;
            if ((err === null || err === void 0 ? void 0 : err.name) === 'AbortError' || ((_d = request.signal) === null || _d === void 0 ? void 0 : _d.aborted))
                throw new PageError('Stopped.', 499);
            throw new PageError(`The connection to ${AGENT_NAME} was cut. Try again.`, 502);
        }
        if (result.stopReason === 'refusal')
            throw new PageError(`${AGENT_NAME} declined to write this page. Describe it differently.`, 422);
        if (!result.stopReason)
            throw new PageError(`The connection to ${AGENT_NAME} was cut. Try again.`, 502);
        return result;
    });
}
