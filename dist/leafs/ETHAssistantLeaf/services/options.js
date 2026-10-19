// ──────────────────────────────────────────────────────────────────────────
// What a project can tell the assistant leaf, and the defaults it falls back
// to. Without an Anthropic key, or with the admin leaf's `features.ai` off,
// the leaf stays registered but answers 503: the back-office then hides the
// assistant.
// ──────────────────────────────────────────────────────────────────────────
import etherial from 'etherial';
/** The hidden back-office collection that lists every question asked. */
export const REQUESTS_COLLECTION = 'assistant-requests';
export const TASKS = ['ask', 'summarize', 'draft'];
/** Most records one proposal may touch: the bulk endpoint takes 100. */
const MAX_PROPOSAL_RECORDS = 100;
export function proposalsOn(config) {
    return !!config.proposals;
}
export function maxRecordsOf(config) {
    const asked = typeof config.proposals === 'object' ? Number(config.proposals.maxRecords) : NaN;
    if (!Number.isFinite(asked) || asked < 1)
        return 50;
    return Math.min(Math.floor(asked), MAX_PROPOSAL_RECORDS);
}
export function historyOn(config) {
    return !!config.history;
}
export function keepDaysOf(config) {
    const asked = typeof config.history === 'object' ? Number(config.history.keepDays) : NaN;
    return Number.isFinite(asked) && asked >= 0 ? Math.floor(asked) : 90;
}
export const DEFAULT_MODELS = { smart: 'claude-sonnet-5-5', fast: 'claude-haiku-5-5' };
export function apiKeyOf(config) {
    return config.apiKey || process.env.ANTHROPIC_API_KEY || undefined;
}
/** The project turned the back-office's AI on: the admin leaf's `features.ai`. */
export function aiAllowed() {
    var _a, _b;
    return !!((_b = (_a = etherial.eth_admin_leaf) === null || _a === void 0 ? void 0 : _a.aiEnabled) === null || _b === void 0 ? void 0 : _b.call(_a));
}
export function modelsOf(config) {
    var _a, _b;
    return { smart: ((_a = config.models) === null || _a === void 0 ? void 0 : _a.smart) || DEFAULT_MODELS.smart, fast: ((_b = config.models) === null || _b === void 0 ? void 0 : _b.fast) || DEFAULT_MODELS.fast };
}
export function timezoneOf(config) {
    return config.timezone || 'UTC';
}
