import { ToolDefinition } from './anthropic.js';
import type { Proposal } from './proposals.js';
import { Step, ToolContext } from './tools.js';
export declare const FLOW_TOOL: ToolDefinition;
/** Whether this person may build automations: the flow leaf is there, and they can open its page. */
export declare function flowsFor(user: any): Promise<boolean>;
export declare function proposeFlow(input: any, context: ToolContext): Promise<{
    proposal: Proposal;
    step: Step;
}>;
