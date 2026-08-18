import type { FlowGraph } from '../types.js';
export interface ValidationIssue {
    level: 'error' | 'warning';
    nodeId?: string;
    message: string;
}
export declare function validateFlow(triggerId: string, graph: FlowGraph | null | undefined): ValidationIssue[];
export declare function hasErrors(issues: ValidationIssue[]): boolean;
