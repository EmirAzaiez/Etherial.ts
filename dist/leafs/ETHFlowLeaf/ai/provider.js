// The AI the flow steps talk to.
//
// The leaf ships no model of its own: which provider, which key and which model
// is a decision each project has already made somewhere. It asks for a function
// and calls it, so a project on Gemini and a project on Claude both get the same
// steps in the palette.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
let provider = null;
export function setAIProvider(next) {
    provider = next;
}
export function aiProvider() {
    return provider;
}
export function hasAI() {
    return provider !== null;
}
export function complete(args) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!provider)
            throw new Error('No AI provider is configured for this workspace.');
        return provider.complete(args);
    });
}
/**
 * Reads JSON out of a model's answer.
 *
 * Models wrap JSON in prose and fences no matter how firmly they are asked not
 * to, and a step that fails because of a stray ```json is a step the customer
 * cannot fix.
 */
export function parseJSON(text) {
    const trimmed = String(text !== null && text !== void 0 ? text : '').trim();
    if (!trimmed)
        return null;
    const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
    const candidate = fenced ? fenced[1].trim() : trimmed;
    try {
        return JSON.parse(candidate);
    }
    catch (_a) {
        // Last resort: the outermost braces or brackets in the answer.
        const start = candidate.search(/[[{]/);
        const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
        if (start === -1 || end <= start)
            return null;
        try {
            return JSON.parse(candidate.slice(start, end + 1));
        }
        catch (_b) {
            return null;
        }
    }
}
