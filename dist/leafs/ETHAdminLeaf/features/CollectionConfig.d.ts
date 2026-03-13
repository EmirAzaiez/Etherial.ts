import { FieldDefinition } from './ActionRegistry.js';
import { SerializedAction } from './ActionRegistry.js';
/**
 * @deprecated Use hasMany field type instead
 * Manual sub-collection config - only use for special cases
 * that can't be handled by hasMany
 */
export interface SubCollection {
    name: string;
    title?: string;
    model: any;
    foreignKey: string;
    fields: string[];
    sort?: {
        field: string;
        direction: 'asc' | 'desc';
    };
    limit?: number;
    filters?: string[];
    crud?: ('show' | 'update' | 'delete')[];
    actions?: string[];
}
export interface ListView {
    fields: string[];
    sort?: {
        field: string;
        direction: 'asc' | 'desc';
    };
    search?: string[];
    filters?: string[];
    include?: any[];
}
export interface ShowView {
    fields?: string[];
    layout?: 'single' | 'tabs' | 'sections';
    sections?: {
        title: string;
        fields: string[];
    }[];
    include?: any[];
    collections?: SubCollection[];
}
export interface FormView {
    fields?: string[];
    layout?: 'single' | 'tabs' | 'sections';
    sections?: {
        title: string;
        fields: string[];
    }[];
}
export interface CollectionViews {
    list?: ListView;
    show?: ShowView;
    create?: FormView;
    edit?: FormView;
}
export interface CollectionMeta {
    label?: string;
    labelPlural?: string;
    icon?: string;
    description?: string;
    group?: string;
    order?: number;
    /**
     * Hide from sidebar menu even if 'list' is in crud
     * Default: false (shown if 'list' is in crud)
     */
    hidden?: boolean;
    /**
     * Show this collection's count in the dashboard stats
     * Default: false
     */
    showInDashboard?: boolean;
}
export interface CollectionStat {
    /**
     * Unique identifier for this stat
     */
    name: string;
    /**
     * Display label
     */
    label: string;
    /**
     * Type of stat:
     * - 'count': Simple total count
     * - 'timeline': Count grouped by date (for charts)
     */
    type: 'count' | 'timeline';
    /**
     * Icon for display
     */
    icon?: string;
    /**
     * Color theme
     */
    color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
    /**
     * Date field to use for timeline stats (default: 'created_at')
     */
    dateField?: string;
    /**
     * Additional WHERE conditions (Sequelize format)
     * Can use special values:
     * - '$not_null$' to check field is not null
     * - '$null$' to check field is null
     */
    where?: Record<string, any>;
    /**
     * Description/help text
     */
    description?: string;
    /**
     * Ignore date range filter for this stat
     * Useful for global counts that should always show total
     * Default: false
     */
    global?: boolean;
}
export interface CollectionConfig {
    name: string;
    model: any;
    crud: ('list' | 'show' | 'create' | 'update' | 'delete')[];
    meta?: CollectionMeta;
    fields?: FieldDefinition[];
    views?: CollectionViews;
    createForm?: any;
    updateForm?: any;
    actions?: string[];
    /**
     * Stats definitions for this collection
     * Displayed in the collection's stats page
     */
    stats?: CollectionStat[];
}
/**
 * Serialized sub-collection with FULL field definitions
 * Frontend can render exactly as defined in hasMany
 */
export interface SerializedSubCollection {
    name: string;
    title?: string;
    foreignKey: string;
    /**
     * Referenced collection name (if using collection-based config)
     */
    collection?: string;
    /**
     * Full field definitions for rendering
     */
    fields: FieldDefinition[];
    sort?: {
        field: string;
        direction: 'asc' | 'desc';
    };
    limit?: number;
    filters?: string[];
    crud?: ('show' | 'update' | 'delete')[];
    actions?: string[];
    /**
     * How to display in show view
     * - 'list': Table view (default)
     * - 'cards': Card grid view
     * - 'gallery': Image gallery
     * - 'timeline': Timeline view
     */
    displayAs?: 'list' | 'cards' | 'gallery' | 'timeline';
    /**
     * Number of columns for cards/gallery (default: 3)
     */
    columns?: 1 | 2 | 3 | 4 | 6;
    /**
     * Show view config from referenced collection (for cards display)
     */
    showView?: {
        layout?: 'single' | 'tabs' | 'sections';
        sections?: {
            title: string;
            fields: string[];
        }[];
    };
    /**
     * Create view config from referenced collection (for inline create)
     */
    createView?: FormView;
    /**
     * Edit view config from referenced collection (for inline edit)
     */
    editView?: FormView;
    /**
     * Configuration from hasMany for inline editing
     */
    inline?: {
        sortable?: boolean;
        orderField?: string;
        min?: number;
        max?: number;
        addLabel?: string;
        layout?: 'card' | 'row';
        titleField?: string;
        previewField?: string;
        collapsible?: boolean;
        defaultCollapsed?: boolean;
        deleteConfirm?: string;
    };
    /**
     * Pagination config
     */
    pagination?: {
        enabled: boolean;
        pageSize: number;
    };
}
export interface SerializedCollection {
    name: string;
    crud: ('list' | 'show' | 'create' | 'update' | 'delete')[];
    meta?: CollectionMeta;
    fields?: FieldDefinition[];
    views?: {
        list?: Omit<ListView, 'include'>;
        show?: Omit<ShowView, 'include' | 'collections'> & {
            collections?: SerializedSubCollection[];
        };
        create?: FormView;
        edit?: FormView;
    };
    actions: SerializedAction[];
    /**
     * COMPUTED: Should this collection appear in the sidebar menu?
     * true if: crud includes 'list' AND meta.hidden is not true
     */
    showInMenu: boolean;
    /**
     * COMPUTED: Default view when opening a record
     * - 'show' if crud includes 'show'
     * - 'edit' if crud includes 'edit' but not 'show'
     * - null if neither (shouldn't happen for valid collections)
     */
    defaultRecordView: 'show' | 'edit' | null;
    /**
     * COMPUTED: Should this collection appear in the dashboard stats?
     * Directly from meta.showInDashboard (default: false)
     */
    showInDashboard: boolean;
    /**
     * Stats definitions for this collection
     */
    stats?: CollectionStat[];
}
