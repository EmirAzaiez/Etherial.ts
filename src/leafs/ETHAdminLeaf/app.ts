import { Etherial } from 'etherial'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
import { ActionRegistry, SerializedAction } from './features/ActionRegistry.js'
import { HookRegistry, ResolvedHooks } from './features/HookRegistry.js'
import { CollectionConfig, SerializedCollection } from './features/CollectionConfig.js'

export type AccessChecker = (
    user: any,
    context: { route: string; method: string }
) => Promise<boolean> | boolean

export type AdminAccessChecker = (user: any) => Promise<boolean> | boolean

export interface AdminSettings {
    appName?: string
    logo?: string
    favicon?: string
    primaryColor?: string
    secondaryColor?: string
    accentColor?: string
    backgroundColor?: string
    textColor?: string
    footerText?: string
    copyrightText?: string
    custom?: Record<string, any>
}

export interface AdminFeatures {
    reactiveMonitoring?: boolean
}

export interface ETHAdminLeafConfig {
    prefix?: string
    settings?: AdminSettings
    features?: AdminFeatures
}

export default class ETHAdminLeaf {
    readonly etherial_module_name = 'eth_admin_leaf'

    private _accessChecker?: AccessChecker
    private _adminAccessChecker?: AdminAccessChecker
    private _config: ETHAdminLeafConfig
    private _collections: Map<string, CollectionConfig> = new Map()
    private _resolvedHooks: Map<string, ResolvedHooks> = new Map()
    private _settings: AdminSettings = {}
    private _features: AdminFeatures = {}

    // Registries
    private _actions: ActionRegistry
    private _hooks: HookRegistry

    private routes: { route: string; methods: string[] }[] = []

    constructor(config: ETHAdminLeafConfig = {}) {
        this._config = { prefix: '/admin', ...config }
        this._settings = config.settings || {}
        this._features = config.features || {}
        this._actions = new ActionRegistry()
        this._hooks = new HookRegistry()

        // Always register settings route
        this.routes.push({
            route: path.join(__dirname, 'routes/settings'),
            methods: ['getPublicSettings', 'getSettings', 'getSchema', 'getCollectionSchema', 'getStats']
        })

        // Always register auth check route
        this.routes.push({
            route: path.join(__dirname, 'routes/auth'),
            methods: ['checkAdminAuthAccess']
        })

        // Register reactive monitoring routes (only if enabled)
        if (this._features.reactiveMonitoring) {
            this.routes.push({
                route: path.join(__dirname, 'routes/reactive'),
                methods: ['debug', 'getStats', 'getConnections', 'getAuthenticatedUsers', 'getGuests', 'getUserStatus']
            })
            console.log('[ETHAdminLeaf] Reactive monitoring enabled')
        }
    }

    /**
     * Action Registry - for user-triggered actions (buttons)
     */
    get actions(): ActionRegistry {
        return this._actions
    }

    /**
     * Hook Registry - for CRUD lifecycle hooks
     */
    get hooks(): HookRegistry {
        return this._hooks
    }

    /**
     * Register a collection for admin CRUD
     */
    registerCollection(config: CollectionConfig): void {
        if (this._collections.has(config.name)) {
            console.warn(`[ETHAdminLeaf] Collection "${config.name}" already registered, overwriting`)
        }

        this._collections.set(config.name, config)

        // Resolve hooks for this collection
        const resolved = this._hooks.resolve(config.name)
        this._resolvedHooks.set(config.name, resolved)

        console.log(`[ETHAdminLeaf] Registered collection: ${config.name}`)
        if (config.actions && config.actions.length > 0) {
            console.log(`  └─ Actions: ${config.actions.join(', ')}`)
        }
    }

    /**
     * Get a registered collection by name
     */
    getCollection(name: string): CollectionConfig | undefined {
        return this._collections.get(name)
    }

    /**
     * Get resolved hooks for a collection
     */
    getResolvedHooks(name: string): ResolvedHooks | undefined {
        return this._resolvedHooks.get(name)
    }

    /**
     * Re-resolve hooks (call after registering new hooks)
     */
    refreshHooks(): void {
        for (const name of this._collections.keys()) {
            const resolved = this._hooks.resolve(name)
            this._resolvedHooks.set(name, resolved)
        }
    }

    /**
     * Get all registered collections
     */
    get collections(): CollectionConfig[] {
        return Array.from(this._collections.values())
    }

    /**
     * Serialize a collection for frontend
     */
    serializeCollection(name: string): SerializedCollection | null {
        const collection = this._collections.get(name)
        if (!collection) return null

        // Serialize actions
        const actions: SerializedAction[] = collection.actions
            ? this._actions.serializeMany(collection.actions)
            : []

        // Extract hasMany fields for auto-generating show collections
        const hasManyFields = collection.fields?.filter(f => f.type === 'hasMany' && f.hasMany) || []

        // Serialize views (remove backend-only properties like include, model)
        const views: SerializedCollection['views'] = {}
        if (collection.views?.list) {
            const { include, ...listRest } = collection.views.list
            views.list = listRest
        }
        if (collection.views?.show) {
            const { include, collections, ...showRest } = collection.views.show

            // Auto-generate collections from hasMany fields with FULL field definitions
            const autoCollections = hasManyFields.map(field => {
                const hm = field.hasMany!

                // Lookup referenced collection
                const refCollection = hm.collection ? this._collections.get(hm.collection) : undefined

                // Get fields: from hasMany.fields, or from referenced collection
                let fields: any[] = []
                if (hm.fields && Array.isArray(hm.fields)) {
                    if (typeof hm.fields[0] === 'string') {
                        // Field names only - lookup from collection
                        const fieldNames = hm.fields as string[]
                        fields = refCollection?.fields?.filter(f => fieldNames.includes(f.name)) || []
                    } else {
                        // Full field definitions provided
                        fields = hm.fields as any[]
                    }
                } else if (refCollection?.fields) {
                    // No fields specified - use all from collection (except id and foreignKey)
                    fields = refCollection.fields.filter(f =>
                        f.name !== 'id' &&
                        f.name !== hm.foreignKey &&
                        !f.readonly
                    )
                }

                // Get show view config from referenced collection
                let showView: { layout?: 'single' | 'tabs' | 'sections'; sections?: { title: string; fields: string[] }[] } | undefined
                if (refCollection?.views?.show) {
                    showView = {
                        layout: refCollection.views.show.layout as 'single' | 'tabs' | 'sections' | undefined,
                        sections: refCollection.views.show.sections,
                    }
                }

                // Get create/edit view config from referenced collection
                let createView = refCollection?.views?.create
                let editView = refCollection?.views?.edit

                return {
                    name: field.name,
                    title: field.label || refCollection?.meta?.labelPlural || field.name,
                    foreignKey: hm.foreignKey,
                    collection: hm.collection,
                    // Fields from collection or inline definition
                    fields,
                    sort: hm.sortable
                        ? { field: hm.orderField || 'order', direction: 'asc' as const }
                        : undefined,
                    limit: hm.pageSize || hm.max,
                    // Display options
                    displayAs: hm.displayAs || 'list',
                    columns: hm.columns,
                    showView,
                    createView,
                    editView,
                    pagination: hm.paginate ? {
                        enabled: true,
                        pageSize: hm.pageSize || 10
                    } : undefined,
                    // Include all inline editing config
                    inline: {
                        sortable: hm.sortable,
                        orderField: hm.orderField,
                        min: hm.min,
                        max: hm.max,
                        addLabel: hm.addLabel,
                        layout: hm.layout,
                        titleField: hm.titleField,
                        previewField: hm.previewField,
                        collapsible: hm.collapsible,
                        defaultCollapsed: hm.defaultCollapsed,
                        deleteConfirm: hm.deleteConfirm,
                    }
                }
            })

            // Manual collections (deprecated but still supported)
            // For manual collections, try to lookup fields from registered collection
            const manualCollections = collections?.map(c => {
                // Try to get full field definitions from registered collection
                const subCollection = this._collections.get(c.name)
                const fullFields = subCollection?.fields?.filter(f => c.fields.includes(f.name)) || []

                return {
                    name: c.name,
                    title: c.title,
                    foreignKey: c.foreignKey,
                    // If we found field definitions, use them; otherwise create basic ones
                    fields: fullFields.length > 0
                        ? fullFields
                        : c.fields.map(fname => ({ name: fname, type: 'string' as const })),
                    sort: c.sort,
                    limit: c.limit,
                    filters: c.filters,
                    crud: c.crud,
                    actions: c.actions
                }
            }) || []

            // Dedupe: if manual config exists for same name, use manual
            const manualNames = new Set(manualCollections.map(c => c.name))
            const finalCollections = [
                ...manualCollections,
                ...autoCollections.filter(c => !manualNames.has(c.name))
            ]

            views.show = {
                ...showRest,
                collections: finalCollections.length > 0 ? finalCollections : undefined
            }
        }
        if (collection.views?.create) views.create = collection.views.create
        if (collection.views?.edit) views.edit = collection.views.edit

        // Compute showInMenu: true if 'list' in crud AND not hidden
        const showInMenu = collection.crud.includes('list') && !collection.meta?.hidden

        // Compute defaultRecordView: prefer 'show', fallback to 'edit'
        let defaultRecordView: 'show' | 'edit' | null = null
        if (collection.crud.includes('show')) {
            defaultRecordView = 'show'
        } else if (collection.crud.includes('update')) {
            defaultRecordView = 'edit'
        }

        // Compute showInDashboard: from meta config
        const showInDashboard = collection.meta?.showInDashboard ?? false

        return {
            name: collection.name,
            crud: collection.crud,
            meta: collection.meta,
            fields: collection.fields,
            views,
            actions,
            showInMenu,
            defaultRecordView,
            showInDashboard,
            stats: collection.stats
        }
    }

    /**
     * Serialize all collections for frontend
     */
    serializeCollections(): SerializedCollection[] {
        const result: SerializedCollection[] = []
        for (const name of this._collections.keys()) {
            const serialized = this.serializeCollection(name)
            if (serialized) result.push(serialized)
        }
        return result
    }

    /**
     * Get the full admin schema for frontend
     */
    getSchema(): {
        settings: AdminSettings
        features: AdminFeatures
        collections: SerializedCollection[]
        media?: {
            cdnUrl?: string
        }
    } {
        // Try to get media config from ETHMediaLeaf if available
        let mediaConfig: { cdnUrl?: string } | undefined
        try {
            const etherial = require('etherial').default
            const mediaLeaf = etherial?.eth_media_leaf
            if (mediaLeaf?.config?.cdn_url) {
                mediaConfig = {
                    cdnUrl: mediaLeaf.config.cdn_url
                }
            }
        } catch {
            // ETHMediaLeaf not available
        }

        return {
            settings: this._settings,
            features: this._features,
            collections: this.serializeCollections(),
            media: mediaConfig
        }
    }

    /**
     * Set access checker for route-level permissions
     */
    setAccessChecker(checker: AccessChecker): void {
        this._accessChecker = checker
    }

    get accessChecker(): AccessChecker | undefined {
        return this._accessChecker
    }

    /**
     * Set admin access checker for panel-level access
     */
    setAdminAccessChecker(checker: AdminAccessChecker): void {
        this._adminAccessChecker = checker
    }

    get adminAccessChecker(): AdminAccessChecker | undefined {
        return this._adminAccessChecker
    }

    /**
     * Check if a user can access the admin panel
     */
    async canAccessAdmin(user: any): Promise<boolean> {
        if (!this._adminAccessChecker) {
            console.warn('[ETHAdminLeaf] No admin access checker set.')
            return false
        }
        return this._adminAccessChecker(user)
    }

    /**
     * Check if a user can access a specific route/method
     */
    async checkAccess(user: any, route: string, method: string): Promise<boolean> {
        if (!this._accessChecker) {
            console.warn('[ETHAdminLeaf] No access checker set.')
            return false
        }
        return this._accessChecker(user, { route, method })
    }

    get config(): ETHAdminLeafConfig {
        return this._config
    }

    get settings(): AdminSettings {
        return this._settings
    }

    get features(): AdminFeatures {
        return this._features
    }

    /**
     * Lifecycle: run - register routes
     */
    run({ http }: Etherial) {
        // Refresh hooks after all registrations
        this.refreshHooks()

        // Register collections route - always register even if collections
        // are not yet registered, as they may be added later in App.run()
        this.routes.push({
            route: path.join(__dirname, 'routes/collections'),
            methods: [
                'list',
                'show',
                'subCollection',
                'showSubCollectionItem',
                'updateSubCollectionItem',
                'deleteSubCollectionItem',
                'executeSubCollectionAction',
                'create',
                'update',
                'delete',
                'executeAction',
                'stats'
            ]
        })

        http?.routes_leafs?.push(...this.routes)

        console.log(`[ETHAdminLeaf] Initialized with ${this._collections.size} collections`)
        console.log(`[ETHAdminLeaf] Actions: ${this._actions.list().join(', ') || 'none'}`)
        console.log(`[ETHAdminLeaf] Hooks: ${this._hooks.list().join(', ') || 'none'}`)
    }

    commands() {
        return []
    }
}

// Re-export types
export * from './features/index.js'
