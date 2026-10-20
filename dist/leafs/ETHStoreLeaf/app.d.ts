import { Etherial } from 'etherial';
import { ETHStoreLeafConfig, StoreName } from './services/options.js';
export * from './services/options.js';
export type { StoreAppInfo } from './models/StoreStatus.js';
/**
 * ETHStoreLeaf — the app on the App Store and Google Play, in the back-office.
 *
 * Every figure comes from the stores' own reports, read with their keys:
 * downloads, re-downloads, updates and uninstalls by country, the store
 * listing (views, first downloads, where they came from), sessions, crashes,
 * the written reviews. Apple's rating alone comes from its public page, the
 * API not giving it. The back-office's Stores page reads them. Postgres only.
 */
export default class ETHStoreLeaf {
    readonly etherial_module_name = "eth_store_leaf";
    config: ETHStoreLeafConfig;
    private routes;
    constructor(config?: ETHStoreLeafConfig);
    /** Lifecycle: beforeRun — hand the tables to the database before it syncs. */
    beforeRun({ database }: Etherial): void;
    /** Lifecycle: run — routes, and the clock that syncs the stores. */
    run({ http }: Etherial): void;
    /** Lifecycle: afterRun — tell the back-office. */
    afterRun(): void;
    /** Syncs the stores now, from the project's own code. False when another server is at it. */
    sync(store?: StoreName): Promise<boolean>;
    commands(): {
        command: string;
        description: string;
        action: () => Promise<{
            success: boolean;
            message: string;
        }>;
    }[];
}
