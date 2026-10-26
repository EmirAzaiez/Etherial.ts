import { Model } from 'etherial/components/database/provider';
import type { FaqSection as FaqSectionRow } from './FaqSection.js';
/** One question of the FAQ and its answer, written in its section's form. */
export declare class FaqQuestion extends Model<FaqQuestion> {
    id: number;
    section_id: number;
    section: FaqSectionRow;
    /** `{ en, ar }` */
    question: Record<string, string>;
    /** `{ en, ar }`, plain paragraphs with a blank line between two. */
    answer: Record<string, string>;
    /** The question in the default language: its card's title in the section's form. Written by the leaf. */
    label: string;
    position: number;
    /** Off: hidden in the app. */
    published: boolean;
    created_at: Date;
    updated_at: Date;
    static fillLabel(question: FaqQuestion): void;
}
