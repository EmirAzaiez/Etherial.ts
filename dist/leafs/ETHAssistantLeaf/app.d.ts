import { Etherial } from 'etherial';
import { ETHAssistantLeafConfig } from './services/options.js';
export * from './services/options.js';
/**
 * ETHAssistantLeaf — Claude in the back-office.
 *
 * Staff ask about their data in plain words ("how many padel bookings this
 * month?") and Claude answers by reading it: it counts, lists and opens
 * records through the back-office's own collections, with the staff member's
 * own rights, and links each figure to the list that shows it. On a record,
 * it also summarizes and drafts a reply in English or Arabic.
 *
 * Read-only. Off until `ANTHROPIC_API_KEY` is set and the admin leaf's
 * `features.ai` is on: what it reads is sent to Anthropic to be answered.
 */
export default class ETHAssistantLeaf {
    readonly etherial_module_name = "eth_assistant_leaf";
    config: ETHAssistantLeafConfig;
    private routes;
    constructor(config?: ETHAssistantLeafConfig);
    /** Lifecycle: beforeRun — hand the log's table to the database before it syncs. */
    beforeRun({ database }: Etherial): void;
    /** Lifecycle: run — the route. */
    run({ http }: Etherial): void;
    /** Lifecycle: afterRun — every collection exists: list the log, tell the back-office. */
    afterRun(): void;
    commands(): {
        command: string;
        description: string;
        action: () => Promise<{
            success: boolean;
            message: string;
        }>;
    }[];
}
