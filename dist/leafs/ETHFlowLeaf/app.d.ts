import { Etherial } from 'etherial';
import { ETHFlowLeafConfig } from './config.js';
import type { FireInput, NodeDefinition, TriggerDefinition } from './types.js';
import type { FlowAIProvider } from './ai/provider.js';
export type { ETHFlowLeafConfig };
export default class ETHFlowLeaf {
    readonly etherial_module_name = "eth_flow_leaf";
    config: ETHFlowLeafConfig;
    private routes;
    private started;
    private builtinsRegistered;
    constructor(config?: ETHFlowLeafConfig);
    /**
     * The leaf owns its three tables and hands them to the database before it
     * syncs, so a project adds the leaf and gets the schema — no migration to
     * copy, nothing to remember on the next deployment.
     */
    beforeRun({ database }: Etherial): Promise<void>;
    /**
     * The built-in palette, registered at most once.
     *
     * `run()` is the normal caller, but the CLI is not run(): `yarn cmd` boots
     * the modules and stops there, so a command that prints the palette would
     * otherwise print an empty one.
     */
    private registerBuiltins;
    run({ http }: Etherial): void;
    /**
     * Hooks and the ticker start last, once every module has registered what it
     * wanted to: a model hook installed before the models exist watches nothing,
     * and a tick fired before the tables are synced fails on its first query.
     */
    afterRun(): Promise<void>;
    /**
     * A domain event of your own — `app.ticket.answered`, `app.deal.won`.
     *
     * Worth registering rather than leaning on `model.tickets.updated`: the
     * customer building the automation reads the palette, and "a ticket was
     * answered" is a thing they recognise, where "a ticket row changed, where
     * the changed fields include answered_at" is a thing they have to decode.
     */
    registerTrigger(definition: TriggerDefinition): void;
    /** A step of your own — anything this leaf cannot reach on its own. */
    registerNode(definition: NodeDefinition): void;
    /** Turns on the AI steps and the "describe your automation" box. */
    setAIProvider(provider: FlowAIProvider | null): void;
    /** Raise an event. Waits for every matching flow. */
    fire(input: FireInput): Promise<import("./engine/fire.js").FireOutcome[]>;
    /**
     * Raise an event without waiting or caring.
     *
     * This is what request handlers should call: answering the customer must
     * not get slower, and must not fail, because an automation attached to the
     * event does.
     */
    emit(input: FireInput): void;
    /** Runs one flow now, outside any trigger. For commands and tests. */
    runFlow(flowId: number, input?: Partial<FireInput>): Promise<import("./engine/fire.js").FireOutcome>;
    get registry(): import("./index.js").Registry;
    /** Call after creating or enabling flows outside the routes. */
    invalidate(): void;
    stop(): void;
    commands(): {
        command: string;
        description: string;
        action: () => Promise<{
            success: boolean;
            message: string;
        }>;
    }[];
}
