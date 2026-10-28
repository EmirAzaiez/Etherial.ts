import { Page } from '../models/Page.js';
export declare function prepareCreate(data: Record<string, any>): Promise<{
    preview_key: any;
    html: {
        [k: string]: string;
    };
    published_slug: string;
    published_at: Date;
    slug: string;
    title: Record<string, string>;
    summary: Record<string, string>;
    blocks: import("./options.js").PageBlocks;
    published: boolean;
    head?: import("./options.js").PageHead | null;
    cover?: import("./options.js").PageImage | null;
}>;
export declare function prepareUpdate(record: Page, data: Record<string, any>): Promise<Record<string, any>>;
/** After the save: the files of the old address go, the preview link shows the new version. */
export declare function afterUpdate(saved: Page): Promise<void>;
