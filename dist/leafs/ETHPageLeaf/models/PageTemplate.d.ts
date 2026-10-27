import { Model } from 'etherial/components/database/provider';
import type { PageBlocks } from '../services/options.js';
/**
 * Blocks saved from the back-office's editor to start another page from:
 * a layout the team likes (a hero, the hours, the contact) kept with its
 * words and images. Read as drafts: a template may hold an unfinished block.
 */
export declare class PageTemplate extends Model<PageTemplate> {
    id: number;
    name: string;
    /** `{ en: [blocks], ar: [blocks] }` */
    blocks: PageBlocks;
    created_at: Date;
    updated_at: Date;
}
