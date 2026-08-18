export interface FlowAICompletion {
    prompt: string;
    system?: string;
    /** Ask for JSON back. Providers that support a JSON mode should turn it on. */
    json?: boolean;
    maxTokens?: number;
    temperature?: number;
}
export interface FlowAIProvider {
    name: string;
    complete: (args: FlowAICompletion) => Promise<string>;
}
export declare function setAIProvider(next: FlowAIProvider | null): void;
export declare function aiProvider(): FlowAIProvider | null;
export declare function hasAI(): boolean;
export declare function complete(args: FlowAICompletion): Promise<string>;
/**
 * Reads JSON out of a model's answer.
 *
 * Models wrap JSON in prose and fences no matter how firmly they are asked not
 * to, and a step that fails because of a stray ```json is a step the customer
 * cannot fix.
 */
export declare function parseJSON<T = any>(text: string): T | null;
