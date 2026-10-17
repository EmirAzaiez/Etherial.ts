import { Usage } from './anthropic.js';
import { AssistantTask } from './options.js';
import { Step } from './tools.js';
export interface AskInput {
    task: AssistantTask;
    /** The conversation so far, the last message the staff member's. */
    messages: {
        role: 'user' | 'assistant';
        content: string;
    }[];
    /** The page they are on. */
    context?: {
        collection?: string;
        id?: string | number;
        filters?: Record<string, unknown>;
        search?: string;
    };
    /** Of a summary or a draft. A question is answered in its own language. */
    language?: 'en' | 'ar';
}
export interface AskOutput {
    answer: string;
    steps: Step[];
    model: string;
    usage: Usage;
}
/** Checks what the back-office sent; throws a 400 the panel can show. */
export declare function parseInput(body: any): AskInput;
/** Requests this person made in the last 24 hours that got an answer. */
export declare function usedToday(userId: number): Promise<number>;
export declare function ask(user: any, input: AskInput): Promise<AskOutput>;
