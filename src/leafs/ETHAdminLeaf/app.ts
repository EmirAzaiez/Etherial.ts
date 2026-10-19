import { Etherial } from 'etherial'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
import { ActionRegistry, SerializedAction, CustomFieldTypeConfig, FieldDefinition } from './features/ActionRegistry.js'
import { HookRegistry, ResolvedHooks } from './features/HookRegistry.js'
import { CollectionConfig, SerializedCollection } from './features/CollectionConfig.js'
import { PageConfig, SerializedPage } from './features/PageConfig.js'
import {
    LoginJournalConfig,
    LOGIN_JOURNAL_COLLECTION,
    loginJournalOptions,
    loginJournalMiddleware,
    loginJournalCollection,
    linkLoginJournalToUsers,
} from './features/loginJournal.js'
import { AdminLoginLog } from './models/AdminLoginLog.js'
import {
    AuditConfig,
    AUDIT_COLLECTION,
    auditOptions,
    auditContextMiddleware,
    auditCollection,
    installAuditHooks,
    linkAuditToUsers,
    scheduleAuditRetention,
} from './features/audit.js'
import { AdminAuditLog } from './models/AdminAuditLog.js'
import { AdminPreference } from './models/AdminPreference.js'
import {
    NotificationsConfig,
    NotifyInput,
    notificationsOptions,
    configureNotifications,
    notifyAdmins,
    scheduleNotificationJobs,
} from './features/notifications.js'
import { AdminNotification } from './models/AdminNotification.js'
import { AdminNote } from './models/AdminNote.js'
import {
    RolesConfig,
    CollectionPermission,
    ADMIN_ROLES_COLLECTION,
    rolesOptions,
    configureRoles,
    rolesConfig,
    resolveAccess,
    canAccessCollection,
    canAccessPage,
    canSeeDashboard,
    canSeeMonitoring,
    isSuperAdmin,
    listAdminUsers,
    writableFields,
    configureSecretColumns,
    secretsMiddleware,
    rolesGateMiddleware,
    linkRolesToUsers,
    adminRolesCollection,
} from './features/access.js'
import { AdminRole } from './models/AdminRole.js'

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
    /** How the back-office menu is laid out. */
    navigation?: AdminNavigation
}

/** A menu group, matched by the `meta.group` the collections and pages declare. */
export interface AdminNavigationGroup {
    name: string
    /** Shown instead of `name` (which stays the key collections refer to). */
    label?: string
    /** A lucide icon name, as `meta.icon`. */
    icon?: string
    /** Closed until opened: reference data one consults rather than works in. */
    collapsed?: boolean
    /**
     * Left out of the back office's menu, search, "New" menu and dashboard: a
     * part not in use yet. Its screens still open by link.
     */
    hidden?: boolean
    /**
     * The group's entries in reading order, whatever group they declare: a
     * collection name, a built-in page (`analytics`, `surveys`, `emails`,
     * `email-campaigns`, `notification-texts`, `reactive-monitoring`) or
     * `pages/<name>` for a custom page. The group's other entries follow, in
     * their `meta.order`. Built-in pages no group lists stay above the groups;
     * a group may hold built-in pages only.
     */
    items?: string[]
}

export interface AdminNavigation {
    /**
     * The menu groups in reading order. Groups not listed follow, in the order
     * the collections declaring them were registered.
     */
    groups?: AdminNavigationGroup[]
}

export interface AdminFeatures {
    reactiveMonitoring?: boolean
    /**
     * Keep a journal of back-office sign-ins (who, when, from where, refused
     * or not), listed in the `admin-logins` collection. Opt-in: the leaf adds
     * an `admin_login_logs` table.
     */
    loginJournal?: boolean | LoginJournalConfig
    /**
     * Record every change to the records the back-office shows: who made it
     * (a person, Salesforce, the system…), through what, and each column
     * before and after. Shown on each record and in the `admin-audit`
     * collection; an edit can be undone from there. Opt-in: the leaf adds an
     * `admin_audit_logs` table. Name an integration's writes with `withActor()`.
     */
    audit?: boolean | AuditConfig
    /**
     * The back-office's AI helpers: the assistant, "Fill with AI",
     * auto-translate, the flow generator. Opt-in: what they read is sent to an
     * AI provider, and every request is paid for. Off, the back-office hides
     * them and their routes refuse; a project's own AI routes ask `aiEnabled()`.
     */
    ai?: boolean
    /**
     * A bell in the back-office header: mentions, flow steps (`admin.notify`)
     * and any code calling `notify()` reach staff there, and by email with
     * `appUrl` set and a mail transport. Opt-in: the leaf adds an
     * `admin_notifications` table.
     */
    notifications?: boolean | NotificationsConfig
    /**
     * Internal notes on every record, with `@mentions` that notify (through
     * `notifications`, when on). Opt-in: the leaf adds an `admin_notes` table.
     */
    notes?: boolean
    /**
     * Keep each user's back-office preferences (favorites, saved views,
     * hidden columns…) on their account instead of in one browser. Opt-in: the
     * leaf adds an `admin_preferences` table and the `/admin/prefs` routes.
     */
    preferences?: boolean
    /**
     * Back-office roles: super admins see everything, staff get what the role
     * linked to their account grants (per collection, page, dashboard and
     * monitoring), configured from an `admin-roles` collection. The leaf
     * installs the access checkers (a project may still replace them) and gates
     * every route under its prefix. Opt-in: the leaf adds an `admin_roles`
     * table; the users table needs the role id column.
     */
    roles?: boolean | RolesConfig
}

export interface ETHAdminLeafConfig {
    prefix?: string
    settings?: AdminSettings
    features?: AdminFeatures
    /**
     * Columns never sent back by the collection routes, on top of the
     * credentials the leaf always holds back (`password`, the reset and
     * confirmation tokens).
     */
    secretColumns?: string[]
}

export default class ETHAdminLeaf {
    readonly etherial_module_name = 'eth_admin_leaf'

    private _accessChecker?: AccessChecker
    private _adminAccessChecker?: AdminAccessChecker
    private _config: ETHAdminLeafConfig
    private _collections: Map<string, CollectionConfig> = new Map()
    private _resolvedHooks: Map<string, ResolvedHooks> = new Map()
    private _pages: Map<string, PageConfig> = new Map()
    private _customFieldTypes: Map<string, CustomFieldTypeConfig> = new Map()
    private _pageFormHandlers: Map<string, (data: any, req: any) => Promise<any>> = new Map()
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

        configureSecretColumns(config.secretColumns)

        // Installed now so a project setting its own checkers later wins.
        const roles = rolesOptions(this._features.roles)
        configureRoles(roles)
        if (roles) {
            this._adminAccessChecker = async (user) => !!(await resolveAccess(user))
            this._accessChecker = async (user, { route, method }) => {
                if (!route) {
                    return false
                }
                return canAccessCollection(await resolveAccess(user), route, method || 'list')
            }
        }

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

        // Global search (the command palette): only reads what the user may list
        this.routes.push({
            route: path.join(__dirname, 'routes/search'),
            methods: ['search']
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

    // ============================================
    // Custom Pages
    // ============================================

    /**
     * Register a custom page
     */
    registerPage(config: PageConfig): void {
        if (this._pages.has(config.name)) {
            console.warn(`[ETHAdminLeaf] Page "${config.name}" already registered, overwriting`)
        }
        this._pages.set(config.name, config)
        console.log(`[ETHAdminLeaf] Registered page: ${config.name}`)
    }

    /**
     * Get a registered page by name
     */
    getPage(name: string): PageConfig | undefined {
        return this._pages.get(name)
    }

    /**
     * Serialize all pages for frontend
     */
    serializePages(): SerializedPage[] {
        const result: SerializedPage[] = []
        for (const page of this._pages.values()) {
            result.push({
                name: page.name,
                title: page.title,
                icon: page.icon,
                group: page.group,
                order: page.order,
                component: page.component,
                showInMenu: page.showInMenu !== false,
                form: page.form ? {
                    fields: page.form.fields,
                    submitEndpoint: page.form.submitEndpoint,
                    submitLabel: page.form.submitLabel,
                } : undefined,
                meta: page.meta,
            })
        }
        return result
    }

    // ============================================
    // Custom Field Types
    // ============================================

    /**
     * Register a custom field type with optional hooks
     */
    registerFieldType(name: string, config?: Omit<CustomFieldTypeConfig, 'name'>): void {
        if (this._customFieldTypes.has(name)) {
            console.warn(`[ETHAdminLeaf] Custom field type "${name}" already registered, overwriting`)
        }
        this._customFieldTypes.set(name, { name, ...config })
        console.log(`[ETHAdminLeaf] Registered custom field type: ${name}`)
    }

    /**
     * Get a custom field type config
     */
    getCustomFieldType(name: string): CustomFieldTypeConfig | undefined {
        return this._customFieldTypes.get(name)
    }

    /**
     * Get all custom field type names
     */
    getCustomFieldTypeNames(): string[] {
        return Array.from(this._customFieldTypes.keys())
    }

    // ============================================
    // Page Form Handlers
    // ============================================

    /**
     * Register a handler for a page form submission
     */
    registerPageFormHandler(pageName: string, handler: (data: any, req: any) => Promise<any>): void {
        this._pageFormHandlers.set(pageName, handler)
        console.log(`[ETHAdminLeaf] Registered form handler for page: ${pageName}`)
    }

    /**
     * Get a page form handler
     */
    getPageFormHandler(pageName: string): ((data: any, req: any) => Promise<any>) | undefined {
        return this._pageFormHandlers.get(pageName)
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
            stats: collection.stats,
            exportable: collection.exportable,
            softDelete: collection.softDelete,
            assistants: collection.assistants
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
        pages: SerializedPage[]
        customFieldTypes: string[]
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
            features: this.publicFeatures(),
            collections: this.serializeCollections(),
            pages: this.serializePages(),
            customFieldTypes: this.getCustomFieldTypeNames(),
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

    /** Whether `user` may run `method` (a CRUD step or an action name) on a collection. */
    canAccess(user: any, collection: string, method: string): Promise<boolean> {
        return this.checkAccess(user, collection, method)
    }

    /** Everything allowed: a super admin with roles, anyone let in without. */
    isSuperAdmin(user: any): Promise<boolean> {
        return isSuperAdmin(user)
    }

    /** The accounts that can open the back-office, optionally only those holding a permission. */
    listAdminUsers(filter?: { collection?: string; permission?: CollectionPermission }): Promise<any[]> {
        return listAdminUsers(filter)
    }

    /** The columns a create or update from the back-office may set. */
    writableFields(collection: CollectionConfig, user: any): Promise<Set<string>> {
        return writableFields(collection, user)
    }

    /**
     * May the user open a collection's records (not only pick them in a
     * relation)? Export, stats and counts need this.
     */
    async canViewCollection(user: any, collection: string): Promise<boolean> {
        return (await this.checkAccess(user, collection, 'list')) && (await this.checkAccess(user, collection, 'show'))
    }

    async canAccessPageFor(user: any, name: string): Promise<boolean> {
        const page = this._pages.get(name)
        if (!page) {
            return false
        }
        if (rolesConfig() && !canAccessPage(await resolveAccess(user), name)) {
            return false
        }
        if (typeof page.canAccess === 'function') {
            try {
                return !!(await page.canAccess(user))
            } catch {
                return false
            }
        }
        return true
    }

    /** The dashboard's stats: with roles, a permission of its own. */
    async canSeeDashboardFor(user: any): Promise<boolean> {
        if (!rolesConfig()) {
            return this.canAccessAdmin(user)
        }
        return canSeeDashboard(await resolveAccess(user))
    }

    /** Live monitoring: with roles, a permission of its own. */
    async canSeeMonitoringFor(user: any): Promise<boolean> {
        if (!rolesConfig()) {
            return this.canAccessAdmin(user)
        }
        return canSeeMonitoring(await resolveAccess(user))
    }

    /**
     * A collection as `user` sees it in the schema. Null when they cannot list
     * it. Listed but not opened, it is a lookup (the target of a relation they
     * work with): out of the menu, list only, so pickers and filters resolve.
     * Otherwise it keeps the CRUD steps and actions they may use.
     */
    async serializeCollectionFor(user: any, name: string): Promise<SerializedCollection | null> {
        const serialized = this.serializeCollection(name)
        if (!serialized) {
            return null
        }
        if (!(await this.checkAccess(user, name, 'list'))) {
            return null
        }
        if (!(await this.checkAccess(user, name, 'show'))) {
            return { ...serialized, crud: ['list'], actions: [], showInMenu: false, showInDashboard: false }
        }

        const crud: SerializedCollection['crud'] = []
        for (const step of serialized.crud) {
            if (await this.checkAccess(user, name, step)) {
                crud.push(step)
            }
        }
        const actions: SerializedAction[] = []
        for (const action of serialized.actions || []) {
            if (await this.checkAccess(user, name, action.name)) {
                actions.push(action)
            }
        }
        return { ...serialized, crud, actions }
    }

    /** The schema as `user` may see it: collections, pages and features they can reach. */
    async getSchemaFor(user: any): Promise<ReturnType<ETHAdminLeaf['getSchema']> & { canSeeDashboard?: boolean }> {
        const schema = this.getSchema()

        const collections: SerializedCollection[] = []
        for (const collection of schema.collections) {
            const visible = await this.serializeCollectionFor(user, collection.name)
            if (visible) {
                collections.push(visible)
            }
        }

        const pages: SerializedPage[] = []
        for (const page of schema.pages) {
            if (await this.canAccessPageFor(user, page.name)) {
                pages.push(page)
            }
        }

        // Without roles the back-office shows the dashboard and monitoring to
        // anyone it lets in, as before.
        if (!rolesConfig()) {
            return { ...schema, collections, pages }
        }

        const access = await resolveAccess(user)
        return {
            ...schema,
            collections,
            pages,
            features: { ...schema.features, reactiveMonitoring: !!schema.features.reactiveMonitoring && canSeeMonitoring(access) },
            canSeeDashboard: canSeeDashboard(access),
        }
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
     * What the back-office needs to know about the features: whether each one
     * is on, never its server-side configuration.
     */
    publicFeatures(): Record<string, any> {
        const { loginJournal, audit, ai, notifications, notes, ...rest } = this._features
        const auditConfig = auditOptions(audit)
        return {
            ...rest,
            ...this._leafFeatures,
            loginJournal: loginJournal ? { collection: LOGIN_JOURNAL_COLLECTION } : false,
            audit: auditConfig
                ? {
                      collection: AUDIT_COLLECTION,
                      collections: this._auditedCollections,
                      usersCollection: auditConfig.usersCollection ?? 'users',
                  }
                : false,
            ai: this.aiEnabled(),
            notifications: notificationsOptions(notifications) ? { enabled: true } : false,
            notes: notes === true,
            preferences: this._features.preferences === true,
            roles: !!rolesConfig(),
        }
    }

    /** Whether the project turned the back-office's AI helpers on (`features.ai`). */
    aiEnabled(): boolean {
        return this._features.ai === true
    }

    private _leafFeatures: Record<string, any> = {}
    private _auditedCollections: string[] = []

    /**
     * Another leaf announcing what it adds to the back-office (Pulse's
     * communications timeline…). Only what the front needs: never secrets.
     */
    setFeature(name: string, value: unknown): void {
        this._leafFeatures[name] = value
    }

    /**
     * Lifecycle: beforeRun - hand the leaf's own tables to the database before
     * it syncs. Only the features turned on add a table.
     */
    beforeRun({ database }: Etherial) {
        if (loginJournalOptions(this._features.loginJournal)) {
            database?.addModels([AdminLoginLog] as any)
        }
        if (auditOptions(this._features.audit)) {
            database?.addModels([AdminAuditLog] as any)
        }
        const notifications = notificationsOptions(this._features.notifications)
        if (notifications) {
            database?.addModels([AdminNotification] as any)
            configureNotifications(notifications)
        }
        if (this._features.notes === true) {
            database?.addModels([AdminNote] as any)
        }
        if (this._features.preferences === true) {
            database?.addModels([AdminPreference] as any)
        }
        if (rolesConfig()) {
            database?.addModels([AdminRole] as any)
        }
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
                'search',
                'relationOptions',
                'export',
                'bulk',
                'show',
                'subCollection',
                'showSubCollectionItem',
                'updateSubCollectionItem',
                'deleteSubCollectionItem',
                'executeSubCollectionAction',
                'create',
                'update',
                'delete',
                'duplicate',
                'restore',
                'executeAction',
                'stats'
            ]
        })

        // Register pages route - always, for the same reason as collections:
        // the leaf's run() fires before the application's, so pages declared
        // from App.run() are still unknown here. Guarding on _pages.size meant
        // the route silently did not exist and every submit answered a plain
        // 404, with the page itself listed in the schema. With no page
        // registered the route is harmless — it answers 'page_not_found'.
        this.routes.push({
            route: path.join(__dirname, 'routes/pages'),
            methods: ['submitForm']
        })

        const audit = auditOptions(this._features.audit)
        if (audit) {
            this.routes.push({
                route: path.join(__dirname, 'routes/audit'),
                methods: ['history', 'restore']
            })
        }

        if (this._features.preferences === true) {
            this.routes.push({
                route: path.join(__dirname, 'routes/prefs'),
                methods: ['list', 'put', 'remove']
            })
        }

        if (notificationsOptions(this._features.notifications)) {
            this.routes.push({
                route: path.join(__dirname, 'routes/notifications'),
                methods: ['list', 'unreadCount', 'markRead', 'markAllRead']
            })
        }

        // `mentionable` is declared before `:collection/:id` in the controller.
        if (this._features.notes === true) {
            this.routes.push({
                route: path.join(__dirname, 'routes/notes'),
                methods: ['mentionable', 'list', 'create', 'update', 'remove']
            })
        }

        http?.routes_leafs?.push(...this.routes)

        // Mounted now, before any controller: http.listen() registers the
        // routes later, so the journal sees the login's answer go out.
        const journal = loginJournalOptions(this._features.loginJournal)
        if (journal && http?.app) {
            http.app.use(loginJournalMiddleware(journal))
            console.log('[ETHAdminLeaf] Login journal enabled')
        }

        // Opened before any controller, so every write a request makes knows who made it.
        if (audit && http?.app) {
            http.app.use(auditContextMiddleware(audit, this._config.prefix ?? '/admin'))
        }

        // Whatever the collection and whoever asks, records go out without
        // their credentials.
        const prefix = this._config.prefix ?? '/admin'
        if (http?.app) {
            http.app.use(`${prefix}/collections`, secretsMiddleware())
            http.app.use(`${prefix}/relation-options`, secretsMiddleware())
        }

        if (rolesConfig()) {
            // Before the project syncs (in its own run or afterRun).
            if (!linkRolesToUsers()) {
                console.warn(`[ETHAdminLeaf] Roles: no "${rolesConfig()?.usersModel}" model, users are not linked to their role`)
            }
            // After the app's cors and body parsers: a preflight must still get its headers.
            http?.beforeRoutes(rolesGateMiddleware(prefix))
            console.log('[ETHAdminLeaf] Roles enabled')
        }

        console.log(`[ETHAdminLeaf] Initialized with ${this._collections.size} collections, ${this._pages.size} pages, ${this._customFieldTypes.size} custom field types`)
        console.log(`[ETHAdminLeaf] Actions: ${this._actions.list().join(', ') || 'none'}`)
        console.log(`[ETHAdminLeaf] Hooks: ${this._hooks.list().join(', ') || 'none'}`)
    }

    /**
     * Lifecycle: afterRun - every model and collection of the project exists
     * now, so the journal can join its rows to the user model and link them
     * to the users collection.
     */
    afterRun() {
        if (rolesConfig() && !this._collections.has(ADMIN_ROLES_COLLECTION)) {
            this.registerCollection(adminRolesCollection())
        }

        const journal = loginJournalOptions(this._features.loginJournal)
        if (journal && !this._collections.has(LOGIN_JOURNAL_COLLECTION)) {
            const linked = linkLoginJournalToUsers(journal)
            const hasUsers = this._collections.has(journal.usersCollection ?? 'users')
            this.registerCollection(loginJournalCollection(journal, hasUsers, linked) as CollectionConfig)
        }

        const audit = auditOptions(this._features.audit)
        if (audit && !this._collections.has(AUDIT_COLLECTION)) {
            this._auditedCollections = installAuditHooks(Array.from(this._collections.values()), audit)
            const linked = linkAuditToUsers(audit)
            const hasUsers = this._collections.has(audit.usersCollection ?? 'users')
            this.registerCollection(auditCollection(audit, this._auditedCollections, hasUsers, linked) as CollectionConfig)
            scheduleAuditRetention(audit)
            console.log(`[ETHAdminLeaf] Change history on ${this._auditedCollections.length} collections`)
        }

        // Started once the tables are synced: the purge and the digest query them.
        const notifications = notificationsOptions(this._features.notifications)
        if (notifications) {
            scheduleNotificationJobs()
            console.log(`[ETHAdminLeaf] Notifications enabled${notifications.appUrl ? '' : ' (no appUrl: no emails)'}`)
        }
    }

    /**
     * Notifies back-office users: see `NotifyInput` for who. Resolves with the
     * number of notifications created, 0 while `features.notifications` is off.
     */
    notify(input: NotifyInput): Promise<number> {
        return notifyAdmins(input)
    }

    /** Whether `features.notifications` is on and `notify()` reaches anyone. */
    notificationsEnabled(): boolean {
        return !!notificationsOptions(this._features.notifications)
    }

    commands() {
        return []
    }
}

// Re-export types
export * from './features/index.js'
