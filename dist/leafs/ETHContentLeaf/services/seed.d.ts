import { ETHContentLeafConfig } from './options.js';
/** The config's `locales`, into Content › Languages, once: the team adds and removes them from then on. */
export declare function seedLanguages(config: ETHContentLeafConfig): Promise<string[]>;
/** The config's `seed`, into the tables that have never had a row. Returns what was written. */
export declare function seedContent(config: ETHContentLeafConfig): Promise<string[]>;
