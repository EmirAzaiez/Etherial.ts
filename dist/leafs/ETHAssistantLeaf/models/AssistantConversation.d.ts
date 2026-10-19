import { Model } from 'etherial/components/database/provider';
/**
 * One person's conversation with the assistant, kept to be reopened from the
 * panel and carried on. Only with the leaf's `history` on: unlike the log, it
 * holds the answers, which are made of the project's data.
 *
 * The turns are kept as the panel shows them — the question, the page it was
 * asked from, the answer, its look-ups, the changes it proposed and what the
 * person decided — in one JSON column: they are only ever read back whole,
 * by their owner.
 */
export declare class AssistantConversation extends Model<AssistantConversation> {
    id: number;
    user_id: number;
    /** The first question, until the person renames it. */
    title: string;
    /**
     * `[{ id, task, prompt, context, where, answer, proposals, at }]`, oldest
     * first. No column default (MySQL takes none on JSON): always written.
     */
    turns: any[];
    created_at: Date;
    updated_at: Date;
}
