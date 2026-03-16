import { Request } from 'express';
import * as yup from 'yup';
export type BuiltinFieldType = 'string' | 'text' | 'number' | 'integer' | 'boolean' | 'date' | 'datetime' | 'email' | 'url' | 'phone' | 'select' | 'multiselect' | 'array' | 'relation' | 'media' | 'image' | 'file' | 'json' | 'hasMany' | 'belongsToMany';
export type FieldType = BuiltinFieldType | (string & {});
export interface FieldOption {
    value: string | number;
    label: string;
    icon?: string;
    color?: string;
}
export interface FieldValidation {
    required?: boolean;
    email?: boolean;
    url?: boolean;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
}
export interface FieldRelation {
    collection: string;
    displayField?: string;
}
export interface FieldMedia {
    /**
     * Folder in S3 where files will be uploaded
     */
    folder: string;
    /**
     * Allowed MIME types (e.g., ['image/jpeg', 'image/png'])
     * If not specified, uses folder rules from ETHMediaLeaf config
     */
    accept?: string[];
    /**
     * Max file size in bytes
     */
    maxSize?: number;
    /**
     * Allow multiple files
     */
    multiple?: boolean;
    /**
     * Show image preview
     */
    preview?: boolean;
    /**
     * Transform config for thumbnails
     */
    thumbnail?: {
        width: number;
        height: number;
        fit?: 'cover' | 'contain' | 'fill';
    };
}
/**
 * Configuration for hasMany (one-to-many) fields
 * Allows editing related records directly in the parent form
 *
 * Use when: Parent has many children via foreignKey
 * Example: Story hasMany StorySlide (via story_id)
 */
export interface FieldHasMany {
    /**
     * Reference to a registered collection
     * This is the PREFERRED way - the collection's fields, views, model are used automatically
     * No need to redefine fields if the collection exists!
     */
    collection?: string;
    /**
     * The Sequelize model for the related items
     * Only needed if `collection` is not specified
     */
    model?: any;
    /**
     * Foreign key field name in the child model (e.g., 'story_id')
     */
    foreignKey: string;
    /**
     * Fields to show/edit for each item
     * OPTIONAL if `collection` is specified - will use the collection's fields
     * Only define this to OVERRIDE or FILTER the collection's fields
     */
    fields?: FieldDefinition[] | string[];
    /**
     * Allow drag & drop reordering (requires an 'order' field)
     */
    sortable?: boolean;
    /**
     * Field name used for ordering (default: 'order')
     */
    orderField?: string;
    /**
     * Minimum number of items required
     */
    min?: number;
    /**
     * Maximum number of items allowed
     */
    max?: number;
    /**
     * Label for the "Add" button
     */
    addLabel?: string;
    /**
     * Layout for each item: 'card' (expanded) or 'row' (compact table-like)
     */
    layout?: 'card' | 'row';
    /**
     * Show a preview/thumbnail for each item (useful for media)
     */
    previewField?: string;
    /**
     * Field to use as item title/label in collapsed view
     */
    titleField?: string;
    /**
     * Allow collapsing items
     */
    collapsible?: boolean;
    /**
     * Start items collapsed by default
     */
    defaultCollapsed?: boolean;
    /**
     * Confirmation message before deleting an item
     */
    deleteConfirm?: string;
    /**
     * How to display items in the show view (as sub-collection)
     * - 'list': Table view (default)
     * - 'cards': Card grid view (uses show layout from registered collection)
     * - 'gallery': Image gallery (for media-heavy items)
     * - 'timeline': Timeline view (for chronological items)
     */
    displayAs?: 'list' | 'cards' | 'gallery' | 'timeline';
    /**
     * Number of columns for cards/gallery view (default: 3)
     */
    columns?: 1 | 2 | 3 | 4 | 6;
    /**
     * Show pagination for large lists
     */
    paginate?: boolean;
    /**
     * Items per page (default: 10)
     */
    pageSize?: number;
}
/**
 * Configuration for belongsToMany (many-to-many) fields
 * Allows selecting multiple related items via junction table
 *
 * Use when: Many-to-many via junction table
 * Example: Post belongsToMany Tag (via post_tags junction)
 */
export interface FieldBelongsToMany {
    /**
     * The Sequelize model for the related items (the "other" side)
     */
    model: any;
    /**
     * Junction table name (string) or model
     */
    through: string | any;
    /**
     * Foreign key in junction table pointing to this model
     */
    foreignKey: string;
    /**
     * Foreign key in junction table pointing to the other model
     */
    otherKey: string;
    /**
     * Collection name for frontend (used to fetch list of related items)
     */
    collection?: string;
    /**
     * Field(s) to display for each item (for select/display)
     */
    displayField: string;
    /**
     * Secondary display field (optional)
     */
    secondaryField?: string;
    /**
     * Allow creating new items inline
     */
    allowCreate?: boolean;
    /**
     * Searchable (for autocomplete)
     */
    searchable?: boolean;
    /**
     * Search fields in the related model
     */
    searchFields?: string[];
    /**
     * Max items that can be selected
     */
    max?: number;
    /**
     * Min items required
     */
    min?: number;
    /**
     * Layout: 'chips' (tags), 'list' (checkboxes), 'transfer' (dual list)
     */
    layout?: 'chips' | 'list' | 'transfer';
    /**
     * Extra fields on junction table to edit
     * Example: post_tags may have 'order' or 'featured' fields
     */
    pivotFields?: FieldDefinition[];
}
/**
 * Condition for showing/hiding a field based on another field's value
 * Evaluated on the frontend only — no backend logic
 */
export interface FieldDependencyCondition {
    field: string;
    operator?: 'eq' | 'ne' | 'in' | 'truthy' | 'falsy';
    value?: any;
}
/**
 * Input format for belongsToMany relations
 * Supports both simple ID arrays and pivot data
 */
export type BelongsToManyInput = number[] | Array<{
    id: number;
    through?: Record<string, any>;
}>;
export interface FieldDefinition {
    name: string;
    type: FieldType;
    label?: string;
    required?: boolean;
    readonly?: boolean;
    hidden?: boolean;
    sortable?: boolean;
    filterable?: boolean;
    searchable?: boolean;
    secure?: boolean;
    helpText?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    options?: FieldOption[];
    defaultValue?: any;
    validation?: FieldValidation;
    relation?: FieldRelation;
    media?: FieldMedia;
    hasMany?: FieldHasMany;
    belongsToMany?: FieldBelongsToMany;
    /**
     * Column span in a 12-column grid system (1-12)
     * Default: 12 (full width)
     * Common values: 12 (full), 6 (half), 4 (third), 3 (quarter)
     */
    col?: number;
    /**
     * Show this field only when the condition is met (frontend-only)
     */
    showIf?: FieldDependencyCondition;
    /**
     * Hide this field when the condition is met (frontend-only)
     */
    hideIf?: FieldDependencyCondition;
}
export interface ActionMeta {
    label: string;
    description?: string;
    icon?: string;
    color?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
    category?: string;
    confirm?: {
        title: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
    };
}
export interface ActionContext {
    collection: any;
    model: any;
    parentId?: string;
    subCollection?: string;
}
export interface ActionResult {
    success: boolean;
    data?: any;
    error?: string;
}
export interface Action {
    name: string;
    meta?: ActionMeta;
    form?: yup.Schema<any>;
    handler: (record: any, data: any, req: Request, context: ActionContext) => Promise<ActionResult>;
}
export interface SerializedAction {
    name: string;
    meta?: ActionMeta;
    form?: FieldDefinition[];
}
export declare function yupToForm(schema: yup.Schema<any>): FieldDefinition[];
export interface CustomFieldTypeConfig {
    name: string;
    beforeSave?: (value: any, field: FieldDefinition) => any;
    afterRead?: (value: any, field: FieldDefinition) => any;
    validate?: (value: any, field: FieldDefinition) => void | Promise<void>;
}
export declare class ActionRegistry {
    private actions;
    /**
     * Register a new action
     */
    register(name: string, action: Omit<Action, 'name'>): void;
    /**
     * Extend an existing action
     */
    extend(name: string, extension: Partial<Omit<Action, 'name'>>): void;
    /**
     * Check if action exists
     */
    has(name: string): boolean;
    /**
     * Get an action
     */
    get(name: string): Action | undefined;
    /**
     * List all action names
     */
    list(): string[];
    /**
     * Execute an action
     */
    execute(name: string, record: any, data: any, req: Request, context: ActionContext): Promise<ActionResult>;
    /**
     * Serialize an action for frontend (with form from Yup)
     */
    serialize(name: string): SerializedAction | null;
    /**
     * Serialize multiple actions
     */
    serializeMany(names: string[]): SerializedAction[];
}
