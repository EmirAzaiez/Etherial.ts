interface SaveContext {
    collection: string;
    record: any | null;
    data: Record<string, any>;
}
/**
 * The field's `beforeSave`: the page written with the record, its id for the
 * column. A record without a page gets one with its first block; the title
 * and the cover follow the record's. Only what changed is published again.
 */
export declare function savePageField(value: unknown, field: any, context: SaveContext): Promise<number | null>;
/** The field's `duplicate`: the copy of a record gets a copy of its page, not a share of it. */
export declare function copyPageField(value: unknown, field: any, context: SaveContext): Promise<number | null>;
/** The field's `afterDelete`: the record's page goes with it, its HTML too. */
export declare function deletePageField(value: unknown, field: any, context: {
    collection: string;
}): Promise<void>;
/**
 * The page of a record, for its form in the back-office: null when it has
 * none yet. Whoever may open the record may read it, Pages or not.
 */
export declare function attachedPage(collectionName: string, id: string, fieldName: string): Promise<{
    id: number;
    slug: string;
    blocks: import("./options.js").PageBlocks;
    head: import("./options.js").PageHead;
    cover: import("./options.js").PageImage;
    published: boolean;
    html: Record<string, string>;
}>;
export {};
