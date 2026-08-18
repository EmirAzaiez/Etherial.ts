import type { FieldDefinition } from '../ETHAdminLeaf/features/ActionRegistry.js';
export type { FieldDefinition };
export interface OutputField {
    /** Path fragment used in templates — `{{record.<key>}}`, `{{steps.<id>.<key>}}`. */
    key: string;
    label: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
    /**
     * The collection this value points at, when it is a foreign key. The builder
     * uses it to offer a record picker on the other side of a comparison instead
     * of a free-text box, and to let the user walk into `{{record.<key>.<field>}}`.
     */
    collection?: string;
    /** Sub-fields, for a hydrated relation or a structured payload. */
    fields?: OutputField[];
}
/**
 * Configuration fields of a trigger or a node.
 *
 * A function when the list depends on something only known later: on what the
 * project registered — the collection picker of a scheduled query has one option
 * per admin collection, and those are not all known when this leaf boots — or on
 * what the user has already filled in, since the date field they pick from
 * depends on the collection they picked first.
 */
export type ConfigSpec = FieldDefinition[] | ((config: Record<string, any>) => FieldDefinition[]);
/**
 * How a trigger reaches the engine. The kind decides who fires it, not what it
 * means: `event` is pushed by application code or a model hook, `schedule` and
 * `query` are pulled by the ticker, `webhook` by an inbound request, `manual` by
 * a human pressing Run.
 */
export type TriggerKind = 'event' | 'schedule' | 'query' | 'webhook' | 'manual';
export interface TriggerDefinition {
    /** e.g. `model.appointments.created`, `schedule.query`, `app.ticket.answered`. */
    id: string;
    label: string;
    description?: string;
    icon?: string;
    kind: TriggerKind;
    /** Palette grouping — usually the collection label, or "Schedule". */
    group?: string;
    /** Registered collection the triggering record belongs to, when there is one. */
    collection?: string;
    /** Extra configuration shown under the trigger in the builder. */
    config?: ConfigSpec;
    /**
     * What `{{record.*}}` holds. A function when the shape depends on the
     * configuration — a scheduled query exposes the collection the user picked,
     * which is not known until they pick it.
     */
    output?: OutputField[] | ((config: Record<string, any>) => OutputField[]);
    /** What `{{trigger.*}}` holds — the event payload, if any. */
    payload?: OutputField[];
    /** Hidden from the palette when it returns false (an unconfigured leaf, say). */
    available?: () => boolean;
}
export interface SerializedTrigger {
    id: string;
    label: string;
    description?: string;
    icon?: string;
    kind: TriggerKind;
    group?: string;
    collection?: string;
    config?: FieldDefinition[];
    output?: OutputField[];
    payload?: OutputField[];
}
export type NodeCategory = 'condition' | 'flow' | 'data' | 'notify' | 'integration' | 'ai' | 'action';
export interface BranchSpec {
    id: string;
    label: string;
    /** Set on dynamic branches (`condition.switch`) — the value that selects it. */
    value?: string;
}
export interface NodeDefinition {
    /** e.g. `condition.if`, `data.update`, `notify.push`. */
    id: string;
    label: string;
    description?: string;
    icon?: string;
    category: NodeCategory;
    config: ConfigSpec;
    output?: OutputField[] | ((config: Record<string, any>) => OutputField[]);
    /** Fixed outgoing handles — `true`/`false` on an if. */
    branches?: BranchSpec[];
    /**
     * Config key holding a `branches` widget value. The builder draws one handle
     * per row it contains, so the user decides how many ways the step forks.
     */
    branchesFromConfig?: string;
    available?: () => boolean;
    execute: NodeExecutor;
}
export interface SerializedNode {
    id: string;
    label: string;
    description?: string;
    icon?: string;
    category: NodeCategory;
    config: FieldDefinition[];
    output?: OutputField[];
    branches?: BranchSpec[];
    branchesFromConfig?: string;
}
export interface NodeResult {
    /** Available downstream as `{{steps.<nodeId>.<key>}}`. */
    output?: Record<string, any>;
    /** Which outgoing handle to follow, for a branching step. */
    branch?: string;
    /** Stop the run here, successfully. `condition.stop` and a failed guard use it. */
    halt?: boolean;
    /**
     * Suspend the run and come back at this instant. The engine writes the whole
     * machine state to the row, so a restart in between changes nothing.
     */
    waitUntil?: Date;
}
export type NodeExecutor = (args: {
    /** Configuration with every `{{…}}` already resolved. */
    config: Record<string, any>;
    context: RunContext;
    /** Adds a line to this step's log — what the operator reads when it misfires. */
    log: (message: string, meta?: Record<string, any>) => void;
}) => Promise<NodeResult>;
export interface GraphNode {
    id: string;
    kind: 'trigger' | 'node';
    /** Trigger id for the entry node, node id for the rest. */
    type: string;
    config: Record<string, any>;
    position: {
        x: number;
        y: number;
    };
    /** Free-form label the user typed over the default one. */
    label?: string;
}
export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    /** Which handle of `source` this edge leaves from, for a branching step. */
    branch?: string;
}
export interface FlowGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
}
/**
 * One level of execution. The engine keeps a stack of these rather than
 * recursing, because a run has to survive being written to a row and picked up
 * again minutes later by another process — which a call stack cannot do.
 *
 * A frame without an `iterator` is the flow itself; one with an iterator is a
 * `flow.for_each` body, replayed once per item.
 */
export interface Frame {
    queue: string[];
    visited: string[];
    iterator?: {
        items: any[];
        index: number;
        bodyStarts: string[];
        /** Nodes belonging to the tail after the loop — fenced off from the body. */
        doneOnly: string[];
        nodeId: string;
    };
}
export interface MachineState {
    frames: Frame[];
    outputs: Record<string, Record<string, any>>;
    /** Values written by `flow.set`, readable as `{{vars.<name>}}`. */
    vars: Record<string, any>;
}
export interface RunContext {
    flowId: number;
    flowName: string;
    runId: number;
    /**
     * The zone dates are rendered in. A reminder that says 09:00 has to mean
     * 09:00 where the customer is, so this is leaf configuration, not a per-flow
     * setting nobody would think to fill in.
     */
    timezone?: string;
    trigger: {
        id: string;
        kind: TriggerKind;
        /** Collection of the triggering record, when there is one. */
        collection?: string;
        payload: Record<string, any>;
    };
    /** The triggering record, hydrated one relation deep. `{{record.*}}`. */
    record: Record<string, any>;
    /** Who caused it. `system` for the ticker, a user id for a manual run. */
    actor: {
        type: 'system' | 'user' | 'guest';
        id?: number;
    };
    state: MachineState;
    /** Innermost loop, when inside one. `{{item.*}}` / `{{loop.*}}`. */
    iterator?: {
        item: any;
        index: number;
        total: number;
    };
    /** Steps already logged for this run, including those from before a wait. */
    logs: StepLog[];
}
export interface StepLog {
    node_id: string;
    node_type: string;
    status: 'success' | 'failed' | 'skipped' | 'waiting';
    started_at: string;
    ended_at: string;
    output?: Record<string, any>;
    branch?: string;
    messages?: {
        text: string;
        meta?: Record<string, any>;
    }[];
    error?: string;
}
export interface FireInput {
    /** Trigger id, e.g. `app.ticket.answered`. */
    triggerId: string;
    /** The record that caused it, already loaded — saves the engine a query. */
    record?: any;
    /** Or its id, when the caller only has that. */
    recordId?: number | string;
    payload?: Record<string, any>;
    actor?: {
        type: 'system' | 'user' | 'guest';
        id?: number;
    };
    /**
     * Idempotency key. When set, the run only happens if no live key with the
     * same value exists for that flow — this is what stops a ten-minute tick
     * from sending the same reminder six times an hour.
     */
    dedupKey?: string;
}
