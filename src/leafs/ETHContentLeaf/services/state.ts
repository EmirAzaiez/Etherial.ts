import { ETHContentLeafConfig, Languages, languagesOf } from './options.js'

/** The running leaf's config, for its controllers and its models' hooks: they are not built by the leaf. */
export const state: {
    config: ETHContentLeafConfig
    /** Content › Languages, once read. Null: the config's. */
    languages: Languages | null
    /** Called each time the languages are read again: the back-office's language switches follow. */
    onLanguages: (() => void)[]
} = { config: {}, languages: null, onLanguages: [] }

/** The languages the contents are written in, now. */
export function languages(): Languages {
    return state.languages ?? languagesOf(state.config)
}
