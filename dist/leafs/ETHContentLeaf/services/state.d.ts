import { ETHContentLeafConfig, Languages } from './options.js';
/** The running leaf's config, for its controllers and its models' hooks: they are not built by the leaf. */
export declare const state: {
    config: ETHContentLeafConfig;
    /** Content › Languages, once read. Null: the config's. */
    languages: Languages | null;
    /** Called each time the languages are read again: the back-office's language switches follow. */
    onLanguages: (() => void)[];
};
/** The languages the contents are written in, now. */
export declare function languages(): Languages;
