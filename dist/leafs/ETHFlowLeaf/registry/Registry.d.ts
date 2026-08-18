import type { TriggerDefinition, NodeDefinition, SerializedTrigger, SerializedNode, OutputField, FieldDefinition, ConfigSpec } from '../types.js';
export declare const MODEL_EVENTS: readonly ["created", "updated", "deleted"];
export type ModelEvent = (typeof MODEL_EVENTS)[number];
/** `model.appointments.created` → its three parts, or null if it isn't one. */
export declare function parseModelTriggerId(id: string): {
    collection: string;
    event: ModelEvent;
} | null;
export declare function resolveConfigSpec(spec: ConfigSpec | undefined, config?: Record<string, any>): FieldDefinition[];
export declare function resolveOutput(output: TriggerDefinition['output'] | NodeDefinition['output'], config: Record<string, any>): OutputField[] | undefined;
/**
 * Appended to every step: what happens when it throws.
 *
 * The default stops the run, because a flow that keeps going after its "find
 * the customer" step failed will cheerfully send a notification to nobody.
 */
export declare function errorFields(): FieldDefinition[];
export declare class Registry {
    private _triggers;
    private _nodes;
    registerTrigger(definition: TriggerDefinition): void;
    registerNode(definition: NodeDefinition): void;
    getTrigger(id: string): TriggerDefinition | null;
    getNode(id: string): NodeDefinition | null;
    /**
     * Every trigger the builder may show, declared first.
     *
     * A project that wants a domain event with a better name than
     * `model.appointments.updated` — `appointment.cancelled`, say — registers it
     * by hand, and it sits next to the derived ones.
     */
    listTriggers(): TriggerDefinition[];
    listNodes(): NodeDefinition[];
    /**
     * "This model was created / changed / deleted", for any collection the admin
     * knows about.
     *
     * The record's fields come from the collection's own `FieldDefinition[]`, so
     * the variable picker in the builder shows the same labels as the edit form —
     * the customer recognises the names, because they are the ones they read all
     * day.
     */
    private deriveModelTrigger;
    /**
     * The palette, as the builder receives it.
     *
     * `output` is resolved with an empty configuration: at palette time nobody
     * has configured anything yet. Once a node is on the canvas the builder asks
     * for its outputs again, with the config it now has — a scheduled query only
     * knows its record shape after the user picks a collection.
     */
    serializeTrigger(trigger: TriggerDefinition, config?: Record<string, any>): SerializedTrigger;
    serializeNode(node: NodeDefinition, config?: Record<string, any>): SerializedNode;
    serialize(): {
        triggers: SerializedTrigger[];
        nodes: SerializedNode[];
    };
}
export declare const registry: Registry;
