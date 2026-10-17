import { Model } from 'etherial/components/database/provider';
/**
 * One question put to the assistant: who asked, what, what it read to answer,
 * and what it cost. The answer itself is not kept — it is made of the
 * project's data, which already lives where it belongs.
 */
export declare class AssistantRequest extends Model<AssistantRequest> {
    id: number;
    user_id: number;
    /** ask, summarize, draft. */
    task: string;
    /** The last thing the person typed, or what they asked for on a record. */
    question: string | null;
    /** The page they were on: a collection, and a record of it. */
    collection: string | null;
    record_id: string | null;
    /** The collections it read to answer, comma separated. */
    collections_read: string | null;
    /** How many look-ups it made. */
    steps: number;
    model: string | null;
    input_tokens: number;
    output_tokens: number;
    /** Input read back from the prompt cache, billed at a tenth. */
    cached_tokens: number;
    duration_ms: number;
    /** ok, failed. */
    status: string;
    error: string | null;
    created_at: Date;
    updated_at: Date;
}
