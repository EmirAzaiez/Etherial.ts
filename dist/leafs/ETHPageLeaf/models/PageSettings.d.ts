import { Model } from 'etherial/components/database/provider';
import type { PageFonts } from '../services/fonts.js';
import type { PageHead } from '../services/options.js';
/**
 * What the back-office sets for every page at once: their fonts, how they
 * open. One row, id 1; what is left out is the theme's.
 */
export declare class PageSettings extends Model<PageSettings> {
    id: number;
    /** `{ title?: 'noto-naskh-arabic', text?: 'rubik' }` */
    fonts: PageFonts;
    /** How every page opens (cover, title): `{ align: 'center', upper: true… }`. Null: the theme's. */
    head: PageHead | null;
    /** What the published HTML was last written with (the theme, the way it is drawn): another, and every page is written again. */
    look: string | null;
    created_at: Date;
    updated_at: Date;
}
