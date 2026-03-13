import { Request } from 'express'
import * as yup from 'yup'

// ============================================
// Field Types (generated from Yup)
// ============================================

export type FieldType =
    | 'string' | 'text' | 'number' | 'integer' | 'boolean' | 'date' | 'datetime'
    | 'email' | 'url' | 'phone' | 'select' | 'multiselect' | 'array' | 'relation'
    | 'media' | 'image' | 'file' | 'json' | 'hasMany' | 'belongsToMany'

export interface FieldOption {
    value: string | number
    label: string
    icon?: string
    color?: string
}

export interface FieldValidation {
    required?: boolean
    email?: boolean
    url?: boolean
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    pattern?: string
}

export interface FieldRelation {
    collection: string
    displayField?: string
}

export interface FieldMedia {
    /**
     * Folder in S3 where files will be uploaded
     */
    folder: string
    /**
     * Allowed MIME types (e.g., ['image/jpeg', 'image/png'])
     * If not specified, uses folder rules from ETHMediaLeaf config
     */
    accept?: string[]
    /**
     * Max file size in bytes
     */
    maxSize?: number
    /**
     * Allow multiple files
     */
    multiple?: boolean
    /**
     * Show image preview
     */
    preview?: boolean
    /**
     * Transform config for thumbnails
     */
    thumbnail?: {
        width: number
        height: number
        fit?: 'cover' | 'contain' | 'fill'
    }
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
    collection?: string
    /**
     * The Sequelize model for the related items
     * Only needed if `collection` is not specified
     */
    model?: any
    /**
     * Foreign key field name in the child model (e.g., 'story_id')
     */
    foreignKey: string
    /**
     * Fields to show/edit for each item
     * OPTIONAL if `collection` is specified - will use the collection's fields
     * Only define this to OVERRIDE or FILTER the collection's fields
     */
    fields?: FieldDefinition[] | string[]  // string[] = field names to include from collection
    /**
     * Allow drag & drop reordering (requires an 'order' field)
     */
    sortable?: boolean
    /**
     * Field name used for ordering (default: 'order')
     */
    orderField?: string
    /**
     * Minimum number of items required
     */
    min?: number
    /**
     * Maximum number of items allowed
     */
    max?: number
    /**
     * Label for the "Add" button
     */
    addLabel?: string
    /**
     * Layout for each item: 'card' (expanded) or 'row' (compact table-like)
     */
    layout?: 'card' | 'row'
    /**
     * Show a preview/thumbnail for each item (useful for media)
     */
    previewField?: string
    /**
     * Field to use as item title/label in collapsed view
     */
    titleField?: string
    /**
     * Allow collapsing items
     */
    collapsible?: boolean
    /**
     * Start items collapsed by default
     */
    defaultCollapsed?: boolean
    /**
     * Confirmation message before deleting an item
     */
    deleteConfirm?: string
    /**
     * How to display items in the show view (as sub-collection)
     * - 'list': Table view (default)
     * - 'cards': Card grid view (uses show layout from registered collection)
     * - 'gallery': Image gallery (for media-heavy items)
     * - 'timeline': Timeline view (for chronological items)
     */
    displayAs?: 'list' | 'cards' | 'gallery' | 'timeline'
    /**
     * Number of columns for cards/gallery view (default: 3)
     */
    columns?: 1 | 2 | 3 | 4 | 6
    /**
     * Show pagination for large lists
     */
    paginate?: boolean
    /**
     * Items per page (default: 10)
     */
    pageSize?: number
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
    model: any
    /**
     * Junction table name (string) or model
     */
    through: string | any
    /**
     * Foreign key in junction table pointing to this model
     */
    foreignKey: string
    /**
     * Foreign key in junction table pointing to the other model
     */
    otherKey: string
    /**
     * Field(s) to display for each item (for select/display)
     */
    displayField: string
    /**
     * Secondary display field (optional)
     */
    secondaryField?: string
    /**
     * Allow creating new items inline
     */
    allowCreate?: boolean
    /**
     * Searchable (for autocomplete)
     */
    searchable?: boolean
    /**
     * Search fields in the related model
     */
    searchFields?: string[]
    /**
     * Max items that can be selected
     */
    max?: number
    /**
     * Min items required
     */
    min?: number
    /**
     * Layout: 'chips' (tags), 'list' (checkboxes), 'transfer' (dual list)
     */
    layout?: 'chips' | 'list' | 'transfer'
    /**
     * Extra fields on junction table to edit
     * Example: post_tags may have 'order' or 'featured' fields
     */
    pivotFields?: FieldDefinition[]
}

export interface FieldDefinition {
    name: string
    type: FieldType
    label?: string
    required?: boolean
    readonly?: boolean
    hidden?: boolean
    sortable?: boolean
    filterable?: boolean
    searchable?: boolean
    secure?: boolean  // Mask sensitive data (shows first 5 chars + ••••• + last 5 chars)
    helpText?: string
    min?: number
    max?: number
    minLength?: number
    maxLength?: number
    options?: FieldOption[]
    defaultValue?: any
    validation?: FieldValidation
    relation?: FieldRelation
    media?: FieldMedia
    hasMany?: FieldHasMany
    belongsToMany?: FieldBelongsToMany
    /**
     * Column span in a 12-column grid system (1-12)
     * Default: 12 (full width)
     * Common values: 12 (full), 6 (half), 4 (third), 3 (quarter)
     */
    col?: number
}

// ============================================
// Action Types
// ============================================

export interface ActionMeta {
    label: string
    description?: string
    icon?: string
    color?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning'
    category?: string
    confirm?: {
        title: string
        message: string
        confirmText?: string
        cancelText?: string
    }
}

export interface ActionContext {
    collection: any
    model: any
    // For sub-collection actions
    parentId?: string
    subCollection?: string
}

export interface ActionResult {
    success: boolean
    data?: any
    error?: string
}

export interface Action {
    name: string
    meta?: ActionMeta
    form?: yup.Schema<any>
    handler: (record: any, data: any, req: Request, context: ActionContext) => Promise<ActionResult>
}

export interface SerializedAction {
    name: string
    meta?: ActionMeta
    form?: FieldDefinition[]
}

// ============================================
// Yup to Form Conversion
// ============================================

function getYupType(schema: any): FieldType {
    const type = schema.type
    if (type === 'string') {
        // Check for special string types
        if (schema.tests?.some((t: any) => t.OPTIONS?.name === 'email')) return 'email'
        if (schema.tests?.some((t: any) => t.OPTIONS?.name === 'url')) return 'url'
        // Check for long text (maxLength > 100 or explicitly text)
        const maxTest = schema.tests?.find((t: any) => t.OPTIONS?.name === 'max')
        if (maxTest && maxTest.OPTIONS?.params?.max > 100) return 'text'
        return 'string'
    }
    if (type === 'number') return 'number'
    if (type === 'boolean') return 'boolean'
    if (type === 'date') return 'date'
    if (type === 'array') return 'array'
    return 'string'
}

function extractFieldFromYup(name: string, schema: any): FieldDefinition {
    const field: FieldDefinition = {
        name,
        type: getYupType(schema),
        label: schema.spec?.label || formatLabel(name),
        required: !schema.spec?.optional && !schema.spec?.nullable,
        defaultValue: schema.spec?.default
    }

    // Extract validation constraints
    for (const test of schema.tests || []) {
        const params = test.OPTIONS?.params
        if (!params) continue

        switch (test.OPTIONS?.name) {
            case 'min':
                if (field.type === 'string') field.minLength = params.min
                else field.min = params.min
                break
            case 'max':
                if (field.type === 'string') field.maxLength = params.max
                else field.max = params.max
                break
            case 'length':
                field.minLength = params.length
                field.maxLength = params.length
                break
        }
    }

    // Extract oneOf options
    if (schema._whitelist?.list?.size > 0) {
        field.type = 'select'
        field.options = Array.from(schema._whitelist.list).map((value: any) => ({
            value,
            label: String(value)
        }))
    }

    return field
}

function formatLabel(name: string): string {
    return name
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase())
        .trim()
}

export function yupToForm(schema: yup.Schema<any>): FieldDefinition[] {
    const fields: FieldDefinition[] = []

    // Get the schema description
    const desc = schema.describe()

    if (desc.type === 'object' && 'fields' in desc) {
        for (const [name, fieldDesc] of Object.entries(desc.fields as Record<string, any>)) {
            const field: FieldDefinition = {
                name,
                type: fieldDesc.type as FieldType || 'string',
                label: fieldDesc.label || formatLabel(name),
                required: !fieldDesc.optional && !fieldDesc.nullable,
                defaultValue: fieldDesc.default
            }

            // Extract tests (validations)
            for (const test of fieldDesc.tests || []) {
                if (test.name === 'min') {
                    if (field.type === 'string') field.minLength = test.params?.min
                    else field.min = test.params?.min
                }
                if (test.name === 'max') {
                    if (field.type === 'string') field.maxLength = test.params?.max
                    else field.max = test.params?.max
                }
                if (test.name === 'email') field.type = 'email'
                if (test.name === 'url') field.type = 'url'
            }

            // Check for oneOf
            if (fieldDesc.oneOf && fieldDesc.oneOf.length > 0) {
                field.type = 'select'
                field.options = fieldDesc.oneOf.map((v: any) => ({ value: v, label: String(v) }))
            }

            // Text type for long strings
            if (field.type === 'string' && field.maxLength && field.maxLength > 100) {
                field.type = 'text'
            }

            fields.push(field)
        }
    }

    return fields
}

// ============================================
// Action Registry
// ============================================

export class ActionRegistry {
    private actions: Map<string, Action> = new Map()

    /**
     * Register a new action
     */
    register(name: string, action: Omit<Action, 'name'>): void {
        if (this.actions.has(name)) {
            console.warn(`[ActionRegistry] Action "${name}" already exists, overwriting`)
        }
        this.actions.set(name, { name, ...action })
        console.log(`[ActionRegistry] Registered: ${name}`)
    }

    /**
     * Extend an existing action
     */
    extend(name: string, extension: Partial<Omit<Action, 'name'>>): void {
        const existing = this.actions.get(name)
        if (!existing) {
            console.warn(`[ActionRegistry] Action "${name}" not found, creating new`)
            this.register(name, extension as Omit<Action, 'name'>)
            return
        }

        this.actions.set(name, {
            name,
            meta: { ...existing.meta, ...extension.meta },
            form: extension.form || existing.form,
            handler: extension.handler || existing.handler,
        })
    }

    /**
     * Check if action exists
     */
    has(name: string): boolean {
        return this.actions.has(name)
    }

    /**
     * Get an action
     */
    get(name: string): Action | undefined {
        return this.actions.get(name)
    }

    /**
     * List all action names
     */
    list(): string[] {
        return Array.from(this.actions.keys())
    }

    /**
     * Execute an action
     */
    async execute(
        name: string,
        record: any,
        data: any,
        req: Request,
        context: ActionContext
    ): Promise<ActionResult> {
        const action = this.actions.get(name)
        if (!action) {
            return { success: false, error: `Action "${name}" not found` }
        }

        // Validate with Yup schema
        if (action.form) {
            try {
                await action.form.validate(data, { abortEarly: false })
            } catch (err: any) {
                const errors = err.inner?.map((e: any) => e.message) || [err.message]
                return { success: false, error: errors.join(', ') }
            }
        }

        try {
            return await action.handler(record, data, req, context)
        } catch (error: any) {
            console.error(`[ActionRegistry] Error executing "${name}":`, error)
            return { success: false, error: error.message }
        }
    }

    /**
     * Serialize an action for frontend (with form from Yup)
     */
    serialize(name: string): SerializedAction | null {
        const action = this.actions.get(name)
        if (!action) return null

        return {
            name: action.name,
            meta: action.meta,
            form: action.form ? yupToForm(action.form) : undefined
        }
    }

    /**
     * Serialize multiple actions
     */
    serializeMany(names: string[]): SerializedAction[] {
        return names
            .map(name => this.serialize(name))
            .filter((a): a is SerializedAction => a !== null)
    }
}
