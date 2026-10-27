export interface StreamRequest {
    apiKey: string;
    baseUrl?: string;
    model: string;
    /** Cached: the rules and the blocks are the same from one page to the next. */
    system: string;
    prompt: string;
    /** PDFs sent with the prompt (a brochure, a flyer), first: base64. */
    documents?: {
        name: string;
        data: string;
    }[];
    /** Pictures sent with the prompt (screenshots, a flyer), before it: base64, as the API takes them. */
    images?: {
        mediaType: string;
        data: string;
    }[];
    maxTokens: number;
    effort?: 'low' | 'medium' | 'high' | 'max';
    /** Ask again on another model when the first one declines (`fallbacks: "default"`). */
    fallbacks: boolean;
    signal?: AbortSignal;
    /** Each piece of the answer, as it comes. */
    onText: (text: string) => void;
    /** Claude is thinking before it writes: nothing to show yet, but something is happening. */
    onThinking?: () => void;
}
export interface StreamResult {
    /** `end_turn`, or `max_tokens` when the page was cut short. */
    stopReason: string;
    /** The model that wrote it: another one when the first declined. */
    model: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
    };
}
/** The answer, streamed into `onText`. Retried only while nothing has been written yet. */
export declare function streamMessage(request: StreamRequest): Promise<StreamResult>;
