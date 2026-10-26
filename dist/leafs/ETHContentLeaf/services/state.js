import { languagesOf } from './options.js';
/** The running leaf's config, for its controllers and its models' hooks: they are not built by the leaf. */
export const state = { config: {}, languages: null, onLanguages: [] };
/** The languages the contents are written in, now. */
export function languages() {
    var _a;
    return (_a = state.languages) !== null && _a !== void 0 ? _a : languagesOf(state.config);
}
