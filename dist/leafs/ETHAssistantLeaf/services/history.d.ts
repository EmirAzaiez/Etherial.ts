import type { Proposal } from './proposals.js';
import type { AskInput, AskOutput } from './run.js';
export type Decision = 'confirmed' | 'cancelled' | 'failed';
export declare const DECISIONS: Decision[];
export interface StoredProposal extends Proposal {
    status?: Decision;
    error?: string;
    /** The record a confirmed create made. */
    createdId?: string | number;
    decidedAt?: string;
}
export interface StoredTurn {
    id: string;
    task: string;
    prompt: string;
    context?: AskInput['context'];
    where?: string;
    language?: string;
    answer: {
        answer: string;
        steps: AskOutput['steps'];
        model: string;
    };
    proposals?: StoredProposal[];
    at: string;
}
/**
 * Adds an answered turn to the person's conversation — a new one when none is
 * named, or when the one named is not theirs (or no longer exists). Returns
 * its id; null when it could not be saved, which never fails the answer.
 */
export declare function saveTurn(userId: number, input: AskInput, output: AskOutput, conversationId?: number, where?: string): Promise<number | null>;
export declare function listConversations(userId: number, search?: string): Promise<{
    id: number;
    title: string;
    turns: number;
    created_at: Date;
    updated_at: Date;
}[]>;
export declare function getConversation(userId: number, id: unknown): Promise<{
    id: number;
    title: string;
    turns: any[];
    created_at: Date;
    updated_at: Date;
}>;
export declare function renameConversation(userId: number, id: unknown, title: string): Promise<boolean>;
export declare function deleteConversation(userId: number, id: unknown): Promise<boolean>;
/** What the person decided on one proposal; false when no such proposal is theirs. */
export declare function recordDecision(userId: number, id: unknown, proposalId: string, decision: {
    status: Decision;
    error?: string;
    createdId?: string | number;
}): Promise<boolean>;
