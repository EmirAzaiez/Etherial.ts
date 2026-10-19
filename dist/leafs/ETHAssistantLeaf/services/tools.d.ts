import type { ToolDefinition } from './anthropic.js';
import { ReadableCollection, ReadableField } from './catalog.js';
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
/** One record, every readable field; null when it is not there. */
export declare function readRecord(collection: ReadableCollection, id: unknown, textLimit?: number): Promise<Record<string, unknown> | null>;
export {};
