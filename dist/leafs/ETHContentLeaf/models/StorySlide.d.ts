import { Model } from 'etherial/components/database/provider';
import type { Story as StoryRow } from './Story.js';
/** One full-screen slide of a story, written in the story's form. `image` is the project's media row. */
export declare class StorySlide extends Model<StorySlide> {
    id: number;
    story_id: number;
    story: StoryRow;
    image_id: number;
    image?: any;
    /** `{ en, ar }`, on the image. Empty: the image alone. */
    title: Record<string, string>;
    text: Record<string, string>;
    /** The button's words, `{ en: 'Learn more' }`. Needs a link. */
    button: Record<string, string>;
    /** `https://…`, or a link of the app's own. */
    link: string | null;
    /** How long it stays before the next one, in seconds. */
    duration: number;
    /** The title in the default language: its card's title in the story's form. Written by the leaf. */
    label: string;
    position: number;
    created_at: Date;
    updated_at: Date;
    static check(slide: StorySlide): void;
}
