import type { Collector } from './collector.js';
import type { IdentifyCache } from './tracking.js';
import type { ETHAnalyticsLeafConfig } from './options.js';
/** The running leaf's parts, for its controllers: they are built by the HTTP component, not by the leaf. */
export declare const state: {
    config: ETHAnalyticsLeafConfig;
    collector: Collector | null;
    identity: IdentifyCache | null;
};
