export type ContentBlock = {
    type: 'text';
    text: string;
} | {
    type: 'tool_use';
    id: string;
    name: string;
    input: any;
} | {
    type: 'tool_result';
    tool_use_id: string;
    content: string;
    is_error?: boolean;
};
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string | ContentBlock[];
}
export interface ToolDefinition {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
}
export interface Usage {
    input_tokens: number;
    output_tokens: number;
    cached_tokens: number;
}
export interface MessageResult {
    content: ContentBlock[];
    stop_reason: string;
    usage: Usage;
}
/** A failure the back-office can explain: `status` is what the route answers. */
export declare class AssistantError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message?: string);
}
export interface MessageRequest {
    apiKey: string;
    baseUrl?: string;
    model: string;
    /**
     * The first part is cached: keep in it what is the same from one question
     * to the next (rules, the collections), the rest (today, the page) after.
     */
    system: string[];
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    /** `none` on the last step: answer with what was read. */
    toolChoice?: 'auto' | 'none';
    maxTokens: number;
    timeoutMs?: number;
}
export declare function createMessage(request: MessageRequest): Promise<MessageResult>;
/** The text of an answer, its blocks joined. */
export declare function textOf(content: ContentBlock[]): string;
