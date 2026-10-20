import type { ToolDefinition } from './anthropic.js';
import { ReadableCollection, ReadableField, SubList } from './catalog.js';
import type { Usage } from './anthropic.js';
import type { FlowGraph } from '../../ETHFlowLeaf/types.js';
import type { Proposal } from './proposals.js';
declare const OPS: readonly ["eq", "ne", "gt", "gte", "lt", "lte", "in", "contains", "is_null", "not_null"];
type FilterOp = (typeof OPS)[number];
export interface Filter {
    field: string;
    op?: FilterOp;
    value?: unknown;
}
/** A look-up that cannot run as asked: told to the assistant, which tries again. */
export declare class ToolError extends Error {
}
/** What the back-office shows under the answer, one per look-up. */
export interface Step {
    tool: string;
    label: string;
    collection?: string;
    count?: number;
    link?: string;
}
export interface ToolContext {
    user: any;
    collections: Map<string, ReadableCollection>;
    /** Collections read, for the log. */
    read: Set<string>;
    /** Changes prepared for the staff member to confirm; absent when the leaf's `proposals` is off. */
    proposals?: Proposal[];
    /** The record form open on their screen, with what it holds now, saved or not. */
    form?: {
        collection: string;
        id?: string;
        values: Record<string, unknown>;
    };
    /** They may build automations: propose_flow is offered. */
    flows?: boolean;
    /** The automation builder open on their screen, with its canvas. */
    flow?: {
        id?: string;
        name?: string;
        graph?: FlowGraph;
    };
    /** Tokens spent by a tool's own model calls, counted with the answer's. */
    usage?: Usage;
}
export declare const TOOLS: ToolDefinition[];
export declare function runTool(name: string, input: any, context: ToolContext): Promise<{
    result: unknown;
    step: Step;
}>;
/** Sequelize's where for the filters and the search; dates by the day are whole days. */
export declare function whereOf(collection: ReadableCollection, filters?: Filter[], search?: string): any;
export declare function formatDate(value: unknown, withTime: boolean): string | null;
/** The names of the records a link field points to: one query per field. */
export declare function relationLabels(field: ReadableField, ids: unknown[]): Promise<Map<string, string>>;
/** A time of day as HH:mm, from minutes after midnight (a column of minutes) or a TIME's "09:00:00". */
export declare function clockOf(value: unknown): string | null;
/** The ids a many-to-many holds, as an include returns them (rows) or a form keeps them (ids). */
export declare function linkedIds(value: unknown): unknown[];
/** A sub-list's items, in the form's order, with the ids their own many-to-manys link to. */
export declare function subListRows(list: SubList, parentId: unknown, limit?: number): Promise<{
    rows: Record<string, any>[];
    total: number;
}>;
/** One record, every readable field and its sub-lists; null when it is not there. */
export declare function readRecord(collection: ReadableCollection, id: unknown, textLimit?: number): Promise<Record<string, unknown> | null>;
export {};
