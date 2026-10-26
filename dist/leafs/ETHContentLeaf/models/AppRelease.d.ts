import { Model } from 'etherial/components/database/provider';
import { Platform, Prompt } from '../services/options.js';
/**
 * A version of the app out on a store, and what an older app does: nothing,
 * a banner that asks to update, or a block until it is updated (`prompt`).
 * Published once it is on the store: before, its button would lead to the
 * version before.
 */
export declare class AppRelease extends Model<AppRelease> {
    id: number;
    /** `ios`, `android`. */
    platform: Platform;
    /** `2.0.0`, as on the store. */
    version: string;
    /** `iOS 2.0.0`, for the back-office. */
    label: string;
    /** `auto`, `banner`, `required` (PROMPTS). */
    prompt: Prompt;
    /** The banner's or the block's title. Empty: the leaf's, in the app's language. */
    title: Record<string, string>;
    message: Record<string, string>;
    published: boolean;
    published_at: Date | null;
    created_at: Date;
    updated_at: Date;
    static check(release: AppRelease): Promise<void>;
}
