import { Model } from 'etherial/components/database/provider';
import type { PageFonts } from '../services/fonts.js';
/**
 * What the back-office sets for every page at once: their fonts. One row,
 * id 1; a font left out is the theme's.
 */
export declare class PageSettings extends Model<PageSettings> {
    id: number;
    /** `{ title?: 'noto-naskh-arabic', text?: 'rubik' }` */
    fonts: PageFonts;
    created_at: Date;
    updated_at: Date;
}
