import type { ToolDefinition } from './anthropic.js';
import { ReadableCollection } from './catalog.js';
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
}
export declare const TOOLS: ToolDefinition[];
export declare function runTool(name: string, input: any, context: ToolContext): Promise<{
    result: unknown;
    step: Step;
}>;
/** One record, every readable field; null when it is not there. */
export declare function readRecord(collection: ReadableCollection, id: unknown, textLimit?: number): Promise<Record<string, unknown> | null>;
export {};
