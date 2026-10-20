import { validateFlow } from '../engine/validate.js';
import type { FlowAICompletion } from './provider.js';
import type { FlowGraph } from '../types.js';
export interface FlowDraft {
    name: string;
    description: string;
    trigger_id: string;
    trigger_config: Record<string, any>;
    graph: FlowGraph;
    notes?: string;
    /** What the generator got wrong and this dropped, in plain words. */
    warnings: string[];
    issues: ReturnType<typeof validateFlow>;
}
/**
 * A graph from a sentence. `run` is the model to ask, the workspace's AI
 * provider unless given: the back-office assistant passes its own.
 */
export declare function generateFlow(prompt: string, existing?: FlowGraph, run?: (args: FlowAICompletion) => Promise<string>): Promise<FlowDraft>;
