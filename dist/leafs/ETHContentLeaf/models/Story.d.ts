import { Model } from 'etherial/components/database/provider';
import { Audience } from '../services/options.js';
import { StorySlide } from './StorySlide.js';
/**
 * A bubble of the home screen and the full-screen slides behind it.
 * `cover` is the project's media row (an association the leaf adds at boot).
 */
export declare class Story extends Model<Story> {
    id: number;
    /** `{ en, ar }`, under the bubble. */
    title: Record<string, string>;
    /** The title in the default language: the back-office's lists and search. Written by the leaf. */
    label: string;
    /** The bubble's picture. Empty: the first slide's. */
    cover_id: number | null;
    cover?: any;
    audience: Audience;
    starts_at: Date | null;
    ends_at: Date | null;
    position: number;
    /** Off: a draft, the app doesn't see it. */
    published: boolean;
    /** Its first publication: the app marks a story it hasn't opened since as new. */
    published_at: Date | null;
    slides: StorySlide[];
    created_at: Date;
    updated_at: Date;
    static check(story: Story): void;
}
