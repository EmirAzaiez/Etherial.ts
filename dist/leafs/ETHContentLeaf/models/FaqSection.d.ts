import { Model } from 'etherial/components/database/provider';
import { FaqQuestion } from './FaqQuestion.js';
/** A heading of the FAQ (General, Payments…) and its questions. The same FAQ for everyone. */
export declare class FaqSection extends Model<FaqSection> {
    id: number;
    /** `{ en, ar }` */
    title: Record<string, string>;
    /** The title in the default language: the back-office's lists and search. Written by the leaf. */
    label: string;
    /** Its place in the FAQ, the smallest first. */
    position: number;
    /** Off: hidden in the app, with its questions. */
    published: boolean;
    questions: FaqQuestion[];
    created_at: Date;
    updated_at: Date;
    static fillLabel(section: FaqSection): void;
}
