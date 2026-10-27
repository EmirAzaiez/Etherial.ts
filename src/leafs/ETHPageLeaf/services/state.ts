import type { ETHPageLeafConfig } from './options.js'

/** The running leaf's config, for its controllers: they are built by the HTTP component, not by the leaf. */
export const state: { config: ETHPageLeafConfig } = { config: {} }
