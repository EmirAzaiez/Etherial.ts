import { Page } from '../models/Page.js';
import type { PageHead, ResolvedBlock } from './options.js';
/**
 * A page as the app gets it: the blocks to draw, how it opens (`head`: the
 * cover's height, the title's place, size, weight, case, color, font; every
 * key set), its cover photo, its record's logo, and the address of its HTML
 * to share or show in a web view.
 */
export declare function serializePage(page: Page, asked: string): {
    in_menu: boolean;
    position: number;
    url: string;
    head: PageHead;
    cover: string;
    logo: string;
    fonts: {
        title: string;
        text: string;
        files: {
            [k: string]: {
                family: string;
                files: Record<string, string>;
            };
        };
    };
    updated_at: Date;
    locale: string;
    dir: "ltr" | "rtl";
    title: string;
    summary: string;
    blocks: ResolvedBlock[];
    id: number;
    slug: string;
};
export type AppPage = ReturnType<typeof serializePage>;
/**
 * The published pages among these ids, as the app gets them: what a record
 * with a `page` field (a news) sends along, so the app draws it at once. A
 * draft is left out.
 */
export declare function publishedPages(ids: (number | null | undefined)[], locale: string): Promise<Map<number, AppPage>>;
