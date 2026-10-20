import { Usage } from './anthropic.js';
import { AssistantTask } from './options.js';
import { Proposal } from './proposals.js';
import { Step } from './tools.js';
export interface AskInput {
    task: AssistantTask;
    /** The conversation so far, the last message the staff member's. */
    messages: {
        role: 'user' | 'assistant';
        content: string;
    }[];
    /**
     * The page they are on; `view` when it is a record's form, new or being
     * edited, and `form`, what that form holds now.
     */
    context?: {
        collection?: string;
        id?: string | number;
        filters?: Record<string, unknown>;
        search?: string;
        view?: 'create' | 'edit';
        form?: Record<string, unknown>;
        /** The automation builder, when it is open: the automation and its canvas. */
        flow?: {
            id?: string;
            name?: string;
            graph?: any;
        };
    };
    /** Of a summary or a draft. A question is answered in its own language. */
    language?: 'en' | 'ar';
    /** The kept conversation this carries on, with `history` on. */
    conversationId?: number;
    /** The page as the panel names it ("Booking #12"), shown when the conversation is reopened. */
    where?: string;
}
export interface AskOutput {
    answer: string;
    steps: Step[];
    model: string;
    usage: Usage;
    /** Changes prepared for the person to confirm. */
    proposals?: Proposal[];
    /** Where the turn was kept, with `history` on. */
    conversationId?: number;
}
/** Checks what the back-office sent; throws a 400 the panel can show. */
export declare function parseInput(body: any): AskInput;
/** Requests this person made in the last 24 hours that got an answer. */
export declare function usedToday(userId: number): Promise<number>;
export declare function ask(user: any, input: AskInput): Promise<AskOutput>;
