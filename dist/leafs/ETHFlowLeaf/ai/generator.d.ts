import { validateFlow } from '../engine/validate.js';
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
export declare function generateFlow(prompt: string, existing?: FlowGraph): Promise<FlowDraft>;
