/** Items read per sub-list: past it, the count says how many more. */
export declare const MAX_ITEMS = 50;
export interface ReadableField {
    name: string;
    label: string;
    type: string;
    options?: {
        value: unknown;
        label: string;
    }[];
    relation?: {
        collection: string;
        displayField: string;
    };
    /** The back-office list can filter on it: a link can carry the filter. */
    listFilter: boolean;
    /** A translations field's languages. */
    locales?: string[];
    /** Computed by the model, not a column: read, never filtered or sorted on. */
    virtual?: boolean;
}
/**
 * A list the record's form edits inline — a hasMany: the items are rows of
 * another table, each pointing back at the record.
 */
export interface SubList {
    name: string;
    label: string;
    /** The items' collection, when they have one. */
    collection?: string;
    model: any;
    foreignKey: string;
    orderField?: string;
    /** How many items the form allows. */
    min?: number;
    max?: number;
    /** The item fields read: a many-to-many among them (`belongsToMany`) holds the ids it links to. */
    fields: ReadableField[];
    /** The item fields as the schema declares them: required, readonly, defaults. */
    definitions: any[];
}
export interface ReadableCollection {
    name: string;
    label: string;
    labelPlural: string;
    description?: string;
    model: any;
    fields: ReadableField[];
    /** Fields the list's search box looks in. */
    search: string[];
    /** Fields shown by default when rows are listed. */
    listFields: string[];
    subLists: SubList[];
}
/** A collection's readable side, whoever asks; null when nothing in it may be read. */
export declare function readable(config: any): ReadableCollection | null;
/**
 * The collections this staff member may read through the assistant: listed
 * in the back-office, and open to their role the way a record page is.
 * Collections a role only looks up in pickers are left out.
 */
export declare function collectionsFor(user: any): Promise<Map<string, ReadableCollection>>;
/** One line per collection, for the assistant to know where to look. */
export declare function catalogText(collections: Map<string, ReadableCollection>): string;
/** What describe_collection answers: enough to filter and group without guessing. */
export declare function describe(collection: ReadableCollection, collections: Map<string, ReadableCollection>): {
    sub_lists?: {
        name: string;
        label: string;
        item_fields: {
            filterable?: boolean;
            languages?: string[];
            note?: string;
            links_to?: string;
            values?: unknown[];
            name: string;
            label: string;
            type: string;
        }[];
    }[];
    searchable_text: string[];
    fields: {
        filterable?: boolean;
        languages?: string[];
        note?: string;
        links_to?: string;
        values?: unknown[];
        name: string;
        label: string;
        type: string;
    }[];
    description?: string;
    collection: string;
    label: string;
};
