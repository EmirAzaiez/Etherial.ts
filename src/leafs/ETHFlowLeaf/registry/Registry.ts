// ──────────────────────────────────────────────────────────────────────────
// What the builder can offer.
//
// Two kinds of entries live here. **Declared** ones are written by hand — the
// condition steps, the loops, the HTTP call — and registered once at boot.
// **Derived** ones are read off the admin schema: every collection yields
// created/updated/deleted triggers and read/write steps, and every registered
// admin action yields a step that runs it.
//
// Derived entries are resolved lazily, on lookup and on serialization, never at
// boot. That is not an optimization: ETHAdminLeaf's own run() fires before the
// application's, so collections registered from App.run() do not exist yet when
// this leaf starts. Deriving eagerly would produce a palette missing exactly the
// project's own models.
// ──────────────────────────────────────────────────────────────────────────

import type {
    TriggerDefinition,
    NodeDefinition,
    SerializedTrigger,
    SerializedNode,
    OutputField,
    FieldDefinition,
    ConfigSpec,
} from '../types.js'

import { dedupFields } from '../engine/dedup.js'
import {
    listCollections,
    getCollection,
    collectionLabel,
    collectionLabelPlural,
    collectionOutputFields,
    humanize,
} from './admin.js'

export const MODEL_EVENTS = ['created', 'updated', 'deleted'] as const
export type ModelEvent = (typeof MODEL_EVENTS)[number]

/** `model.appointments.created` → its three parts, or null if it isn't one. */
export function parseModelTriggerId(
    id: string
): { collection: string; event: ModelEvent } | null {
    const parts = id.split('.')
    if (parts.length !== 3 || parts[0] !== 'model') return null
    if (!MODEL_EVENTS.includes(parts[2] as ModelEvent)) return null
    return { collection: parts[1], event: parts[2] as ModelEvent }
}

export function resolveConfigSpec(
    spec: ConfigSpec | undefined,
    config: Record<string, any> = {}
): FieldDefinition[] {
    if (!spec) return []
    return typeof spec === 'function' ? spec(config) : spec
}

export function resolveOutput(
    output: TriggerDefinition['output'] | NodeDefinition['output'],
    config: Record<string, any>
): OutputField[] | undefined {
    if (!output) return undefined
    return typeof output === 'function' ? output(config) : output
}

/**
 * Appended to every step: what happens when it throws.
 *
 * The default stops the run, because a flow that keeps going after its "find
 * the customer" step failed will cheerfully send a notification to nobody.
 */
export function errorFields(): FieldDefinition[] {
    return [
        {
            name: 'on_error',
            type: 'select',
            label: 'If this step fails',
            defaultValue: 'stop',
            options: [
                { value: 'stop', label: 'Stop the automation' },
                { value: 'continue', label: 'Log it and carry on' },
            ],
        },
    ]
}

export class Registry {
    private _triggers: Map<string, TriggerDefinition> = new Map()
    private _nodes: Map<string, NodeDefinition> = new Map()

    // ─── Declaration ──────────────────────────────────────────────────────

    registerTrigger(definition: TriggerDefinition): void {
        if (this._triggers.has(definition.id)) {
            console.warn(`[ETHFlowLeaf] Trigger "${definition.id}" already registered, overwriting`)
        }
        this._triggers.set(definition.id, definition)
    }

    registerNode(definition: NodeDefinition): void {
        if (this._nodes.has(definition.id)) {
            console.warn(`[ETHFlowLeaf] Node "${definition.id}" already registered, overwriting`)
        }
        this._nodes.set(definition.id, definition)
    }

    // ─── Lookup ───────────────────────────────────────────────────────────

    getTrigger(id: string): TriggerDefinition | null {
        const declared = this._triggers.get(id)
        if (declared) return declared
        return this.deriveModelTrigger(id)
    }

    getNode(id: string): NodeDefinition | null {
        return this._nodes.get(id) ?? null
    }

    /**
     * Every trigger the builder may show, declared first.
     *
     * A project that wants a domain event with a better name than
     * `model.appointments.updated` — `appointment.cancelled`, say — registers it
     * by hand, and it sits next to the derived ones.
     */
    listTriggers(): TriggerDefinition[] {
        const all: TriggerDefinition[] = []

        for (const trigger of this._triggers.values()) {
            if (trigger.available && !trigger.available()) continue
            all.push(trigger)
        }

        for (const collection of listCollections()) {
            for (const event of MODEL_EVENTS) {
                const id = `model.${collection.name}.${event}`
                if (this._triggers.has(id)) continue
                const derived = this.deriveModelTrigger(id)
                if (derived) all.push(derived)
            }
        }

        return all
    }

    listNodes(): NodeDefinition[] {
        return Array.from(this._nodes.values()).filter(
            (node) => !node.available || node.available()
        )
    }

    // ─── Derivation ───────────────────────────────────────────────────────

    /**
     * "This model was created / changed / deleted", for any collection the admin
     * knows about.
     *
     * The record's fields come from the collection's own `FieldDefinition[]`, so
     * the variable picker in the builder shows the same labels as the edit form —
     * the customer recognises the names, because they are the ones they read all
     * day.
     */
    private deriveModelTrigger(id: string): TriggerDefinition | null {
        const parsed = parseModelTriggerId(id)
        if (!parsed) return null

        const collection = getCollection(parsed.collection)
        if (!collection) return null

        const label = collectionLabel(collection)
        const group = collectionLabelPlural(collection)

        const base = {
            id,
            kind: 'event' as const,
            group,
            collection: collection.name,
            icon: collection.meta?.icon,
            output: () => collectionOutputFields(collection.name),
        }

        if (parsed.event === 'created') {
            return {
                ...base,
                label: `${label} created`,
                description: `Runs when a ${label.toLowerCase()} is added.`,
            }
        }

        if (parsed.event === 'deleted') {
            return {
                ...base,
                label: `${label} deleted`,
                description: `Runs when a ${label.toLowerCase()} is removed.`,
                // The record still exists in the payload — it is the only place it
                // exists any more, which is precisely what a deletion automation
                // needs to write to a log or to notify about.
            }
        }

        return {
            ...base,
            label: `${label} updated`,
            description: `Runs when a ${label.toLowerCase()} is modified.`,
            config: () => [
                {
                    name: 'watch_fields',
                    type: 'multiselect',
                    label: 'Only when these fields change',
                    helpText: 'Leave empty to run on any change.',
                    options: (collection.fields ?? [])
                        .filter((f) => f.type !== 'hasMany' && f.type !== 'belongsToMany')
                        .map((f) => ({ value: f.name, label: f.label || humanize(f.name) })),
                },
            ],
            payload: [
                { key: 'changed', label: 'Changed fields', type: 'array' },
                {
                    key: 'previous',
                    label: 'Previous values',
                    type: 'object',
                    fields: collectionOutputFields(collection.name, 0),
                },
            ],
        }
    }

    // ─── Serialization ────────────────────────────────────────────────────

    /**
     * The palette, as the builder receives it.
     *
     * `output` is resolved with an empty configuration: at palette time nobody
     * has configured anything yet. Once a node is on the canvas the builder asks
     * for its outputs again, with the config it now has — a scheduled query only
     * knows its record shape after the user picks a collection.
     */
    serializeTrigger(trigger: TriggerDefinition, config: Record<string, any> = {}): SerializedTrigger {
        return {
            id: trigger.id,
            label: trigger.label,
            description: trigger.description,
            icon: trigger.icon,
            kind: trigger.kind,
            group: trigger.group,
            collection: trigger.collection,
            // Every trigger carries the repeat policy, whatever it is: a domain
            // event fired twice by a retried request is the same double
            // notification as a scheduled query matching twice.
            config: [...resolveConfigSpec(trigger.config, config), ...dedupFields()],
            output: resolveOutput(trigger.output, config),
            payload: trigger.payload,
        }
    }

    serializeNode(node: NodeDefinition, config: Record<string, any> = {}): SerializedNode {
        return {
            id: node.id,
            label: node.label,
            description: node.description,
            icon: node.icon,
            category: node.category,
            config: [...resolveConfigSpec(node.config, config), ...errorFields()],
            output: resolveOutput(node.output, config),
            branches: node.branches,
            branchesFromConfig: node.branchesFromConfig,
        }
    }

    serialize(): { triggers: SerializedTrigger[]; nodes: SerializedNode[] } {
        return {
            triggers: this.listTriggers().map((t) => this.serializeTrigger(t)),
            nodes: this.listNodes().map((n) => this.serializeNode(n)),
        }
    }
}

export const registry = new Registry()
