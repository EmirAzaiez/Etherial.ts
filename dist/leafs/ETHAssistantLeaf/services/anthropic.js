var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { AGENT_NAME } from './options.js';
/** A failure the back-office can explain: `status` is what the route answers. */
export class AssistantError extends Error {
    constructor(status, code, message) {
        super(message || code);
        this.status = status;
        this.code = code;
    }
}
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 529]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export function createMessage(request) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const base = (request.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
        // The system prompt and the tools are the same from one question to the
        // next: cached, they are billed at a tenth after the first call.
        const tools = (_a = request.tools) === null || _a === void 0 ? void 0 : _a.map((tool, i, all) => (i === all.length - 1 ? Object.assign(Object.assign({}, tool), { cache_control: { type: 'ephemeral' } }) : tool));
        const body = JSON.stringify(Object.assign({ model: request.model, max_tokens: request.maxTokens, system: request.system
                .filter(Boolean)
                .map((text, i) => (i === 0 ? { type: 'text', text, cache_control: { type: 'ephemeral' } } : { type: 'text', text })), messages: request.messages }, ((tools === null || tools === void 0 ? void 0 : tools.length) ? { tools, tool_choice: { type: request.toolChoice || 'auto' } } : {})));
        let lastError = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt)
                yield sleep((lastError === null || lastError === void 0 ? void 0 : lastError.status) === 503 ? 2000 * attempt : 800 * attempt);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), (_b = request.timeoutMs) !== null && _b !== void 0 ? _b : 60000);
            let response;
            try {
                response = yield fetch(`${base}/v1/messages`, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'x-api-key': request.apiKey,
                        'anthropic-version': '2023-06-01',
                    },
                    body,
                    signal: controller.signal,
                });
            }
            catch (err) {
                lastError =
                    (err === null || err === void 0 ? void 0 : err.name) === 'AbortError'
                        ? new AssistantError(504, 'provider_timeout', `${AGENT_NAME} took too long to answer`)
                        : new AssistantError(502, 'provider_unreachable', `Could not reach ${AGENT_NAME}`);
                continue;
            }
            finally {
                clearTimeout(timer);
            }
            const text = yield response.text();
            let json = null;
            try {
                json = text ? JSON.parse(text) : null;
            }
            catch (_d) {
                // Not JSON: a proxy's error page.
            }
            if (response.ok && (json === null || json === void 0 ? void 0 : json.content)) {
                const usage = json.usage || {};
                return {
                    content: json.content,
                    stop_reason: json.stop_reason,
                    usage: {
                        input_tokens: (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.cache_read_input_tokens || 0),
                        output_tokens: usage.output_tokens || 0,
                        cached_tokens: usage.cache_read_input_tokens || 0,
                    },
                };
            }
            const detail = ((_c = json === null || json === void 0 ? void 0 : json.error) === null || _c === void 0 ? void 0 : _c.message) ? String(json.error.message).slice(0, 200) : `HTTP ${response.status}`;
            if (response.status === 401 || response.status === 403)
                throw new AssistantError(502, 'provider_auth', `The Anthropic key was refused: ${detail}`);
            if (!RETRYABLE.has(response.status))
                throw new AssistantError(502, 'provider_rejected', detail);
            lastError = new AssistantError(503, 'provider_busy', `${AGENT_NAME} is busy: ${detail}`);
        }
        throw lastError !== null && lastError !== void 0 ? lastError : new AssistantError(502, 'provider_unreachable');
    });
}
/** The text of an answer, its blocks joined. */
export function textOf(content) {
    return content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n\n')
        .trim();
}
