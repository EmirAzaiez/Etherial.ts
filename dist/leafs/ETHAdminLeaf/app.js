var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import * as path from 'path';
import { ActionRegistry } from './features/ActionRegistry';
import { HookRegistry } from './features/HookRegistry';
export default class ETHAdminLeaf {
    constructor(config = {}) {
        this.etherial_module_name = 'eth_admin_leaf';
        this._collections = new Map();
        this._resolvedHooks = new Map();
        this._settings = {};
        this._features = {};
        this.routes = [];
        this._config = Object.assign({ prefix: '/admin' }, config);
        this._settings = config.settings || {};
        this._features = config.features || {};
        this._actions = new ActionRegistry();
        this._hooks = new HookRegistry();
        // Always register settings route
        this.routes.push({
            route: path.join(__dirname, 'routes/settings'),
            methods: ['getPublicSettings', 'getSettings', 'getSchema', 'getCollectionSchema', 'getStats']
        });
        // Always register auth check route
        this.routes.push({
            route: path.join(__dirname, 'routes/auth'),
            methods: ['checkAdminAuthAccess']
        });
        // Register reactive monitoring routes (only if enabled)
        if (this._features.reactiveMonitoring) {
            this.routes.push({
                route: path.join(__dirname, 'routes/reactive'),
                methods: ['debug', 'getStats', 'getConnections', 'getAuthenticatedUsers', 'getGuests', 'getUserStatus']
            });
            console.log('[ETHAdminLeaf] Reactive monitoring enabled');
        }
    }
    /**
     * Action Registry - for user-triggered actions (buttons)
     */
    get actions() {
        return this._actions;
    }
    /**
     * Hook Registry - for CRUD lifecycle hooks
     */
    get hooks() {
        return this._hooks;
    }
    /**
     * Register a collection for admin CRUD
     */
    registerCollection(config) {
        if (this._collections.has(config.name)) {
            console.warn(`[ETHAdminLeaf] Collection "${config.name}" already registered, overwriting`);
        }
        this._collections.set(config.name, config);
        // Resolve hooks for this collection
        const resolved = this._hooks.resolve(config.name);
        this._resolvedHooks.set(config.name, resolved);
        console.log(`[ETHAdminLeaf] Registered collection: ${config.name}`);
        if (config.actions && config.actions.length > 0) {
            console.log(`  └─ Actions: ${config.actions.join(', ')}`);
        }
    }
    /**
     * Get a registered collection by name
     */
    getCollection(name) {
        return this._collections.get(name);
    }
    /**
     * Get resolved hooks for a collection
     */
    getResolvedHooks(name) {
        return this._resolvedHooks.get(name);
    }
    /**
     * Re-resolve hooks (call after registering new hooks)
     */
    refreshHooks() {
        for (const name of this._collections.keys()) {
            const resolved = this._hooks.resolve(name);
            this._resolvedHooks.set(name, resolved);
        }
    }
    /**
     * Get all registered collections
     */
    get collections() {
        return Array.from(this._collections.values());
    }
    /**
     * Serialize a collection for frontend
     */
    serializeCollection(name) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const collection = this._collections.get(name);
        if (!collection)
            return null;
        // Serialize actions
        const actions = collection.actions
            ? this._actions.serializeMany(collection.actions)
            : [];
        // Extract hasMany fields for auto-generating show collections
        const hasManyFields = ((_a = collection.fields) === null || _a === void 0 ? void 0 : _a.filter(f => f.type === 'hasMany' && f.hasMany)) || [];
        // Serialize views (remove backend-only properties like include, model)
        const views = {};
        if ((_b = collection.views) === null || _b === void 0 ? void 0 : _b.list) {
            const _j = collection.views.list, { include } = _j, listRest = __rest(_j, ["include"]);
            views.list = listRest;
        }
        if ((_c = collection.views) === null || _c === void 0 ? void 0 : _c.show) {
            const _k = collection.views.show, { include, collections } = _k, showRest = __rest(_k, ["include", "collections"]);
            // Auto-generate collections from hasMany fields with FULL field definitions
            const autoCollections = hasManyFields.map(field => {
                var _a, _b, _c, _d, _e;
                const hm = field.hasMany;
                // Lookup referenced collection
                const refCollection = hm.collection ? this._collections.get(hm.collection) : undefined;
                // Get fields: from hasMany.fields, or from referenced collection
                let fields = [];
                if (hm.fields && Array.isArray(hm.fields)) {
                    if (typeof hm.fields[0] === 'string') {
                        // Field names only - lookup from collection
                        const fieldNames = hm.fields;
                        fields = ((_a = refCollection === null || refCollection === void 0 ? void 0 : refCollection.fields) === null || _a === void 0 ? void 0 : _a.filter(f => fieldNames.includes(f.name))) || [];
                    }
                    else {
                        // Full field definitions provided
                        fields = hm.fields;
                    }
                }
                else if (refCollection === null || refCollection === void 0 ? void 0 : refCollection.fields) {
                    // No fields specified - use all from collection (except id and foreignKey)
                    fields = refCollection.fields.filter(f => f.name !== 'id' &&
                        f.name !== hm.foreignKey &&
                        !f.readonly);
                }
                // Get show view config from referenced collection
                let showView;
                if ((_b = refCollection === null || refCollection === void 0 ? void 0 : refCollection.views) === null || _b === void 0 ? void 0 : _b.show) {
                    showView = {
                        layout: refCollection.views.show.layout,
                        sections: refCollection.views.show.sections,
                    };
                }
                // Get create/edit view config from referenced collection
                let createView = (_c = refCollection === null || refCollection === void 0 ? void 0 : refCollection.views) === null || _c === void 0 ? void 0 : _c.create;
                let editView = (_d = refCollection === null || refCollection === void 0 ? void 0 : refCollection.views) === null || _d === void 0 ? void 0 : _d.edit;
                return {
                    name: field.name,
                    title: field.label || ((_e = refCollection === null || refCollection === void 0 ? void 0 : refCollection.meta) === null || _e === void 0 ? void 0 : _e.labelPlural) || field.name,
                    foreignKey: hm.foreignKey,
                    collection: hm.collection,
                    // Fields from collection or inline definition
                    fields,
                    sort: hm.sortable
                        ? { field: hm.orderField || 'order', direction: 'asc' }
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
                };
            });
            // Manual collections (deprecated but still supported)
            // For manual collections, try to lookup fields from registered collection
            const manualCollections = (collections === null || collections === void 0 ? void 0 : collections.map(c => {
                var _a;
                // Try to get full field definitions from registered collection
                const subCollection = this._collections.get(c.name);
                const fullFields = ((_a = subCollection === null || subCollection === void 0 ? void 0 : subCollection.fields) === null || _a === void 0 ? void 0 : _a.filter(f => c.fields.includes(f.name))) || [];
                return {
                    name: c.name,
                    title: c.title,
                    foreignKey: c.foreignKey,
                    // If we found field definitions, use them; otherwise create basic ones
                    fields: fullFields.length > 0
                        ? fullFields
                        : c.fields.map(fname => ({ name: fname, type: 'string' })),
                    sort: c.sort,
                    limit: c.limit,
                    filters: c.filters,
                    crud: c.crud,
                    actions: c.actions
                };
            })) || [];
            // Dedupe: if manual config exists for same name, use manual
            const manualNames = new Set(manualCollections.map(c => c.name));
            const finalCollections = [
                ...manualCollections,
                ...autoCollections.filter(c => !manualNames.has(c.name))
            ];
            views.show = Object.assign(Object.assign({}, showRest), { collections: finalCollections.length > 0 ? finalCollections : undefined });
        }
        if ((_d = collection.views) === null || _d === void 0 ? void 0 : _d.create)
            views.create = collection.views.create;
        if ((_e = collection.views) === null || _e === void 0 ? void 0 : _e.edit)
            views.edit = collection.views.edit;
        // Compute showInMenu: true if 'list' in crud AND not hidden
        const showInMenu = collection.crud.includes('list') && !((_f = collection.meta) === null || _f === void 0 ? void 0 : _f.hidden);
        // Compute defaultRecordView: prefer 'show', fallback to 'edit'
        let defaultRecordView = null;
        if (collection.crud.includes('show')) {
            defaultRecordView = 'show';
        }
        else if (collection.crud.includes('update')) {
            defaultRecordView = 'edit';
        }
        // Compute showInDashboard: from meta config
        const showInDashboard = (_h = (_g = collection.meta) === null || _g === void 0 ? void 0 : _g.showInDashboard) !== null && _h !== void 0 ? _h : false;
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
        };
    }
    /**
     * Serialize all collections for frontend
     */
    serializeCollections() {
        const result = [];
        for (const name of this._collections.keys()) {
            const serialized = this.serializeCollection(name);
            if (serialized)
                result.push(serialized);
        }
        return result;
    }
    /**
     * Get the full admin schema for frontend
     */
    getSchema() {
        var _a;
        // Try to get media config from ETHMediaLeaf if available
        let mediaConfig;
        try {
            const etherial = require('etherial').default;
            const mediaLeaf = etherial === null || etherial === void 0 ? void 0 : etherial.eth_media_leaf;
            if ((_a = mediaLeaf === null || mediaLeaf === void 0 ? void 0 : mediaLeaf.config) === null || _a === void 0 ? void 0 : _a.cdn_url) {
                mediaConfig = {
                    cdnUrl: mediaLeaf.config.cdn_url
                };
            }
        }
        catch (_b) {
            // ETHMediaLeaf not available
        }
        return {
            settings: this._settings,
            features: this._features,
            collections: this.serializeCollections(),
            media: mediaConfig
        };
    }
    /**
     * Set access checker for route-level permissions
     */
    setAccessChecker(checker) {
        this._accessChecker = checker;
    }
    get accessChecker() {
        return this._accessChecker;
    }
    /**
     * Set admin access checker for panel-level access
     */
    setAdminAccessChecker(checker) {
        this._adminAccessChecker = checker;
    }
    get adminAccessChecker() {
        return this._adminAccessChecker;
    }
    /**
     * Check if a user can access the admin panel
     */
    canAccessAdmin(user) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._adminAccessChecker) {
                console.warn('[ETHAdminLeaf] No admin access checker set.');
                return false;
            }
            return this._adminAccessChecker(user);
        });
    }
    /**
     * Check if a user can access a specific route/method
     */
    checkAccess(user, route, method) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this._accessChecker) {
                console.warn('[ETHAdminLeaf] No access checker set.');
                return false;
            }
            return this._accessChecker(user, { route, method });
        });
    }
    get config() {
        return this._config;
    }
    get settings() {
        return this._settings;
    }
    get features() {
        return this._features;
    }
    /**
     * Lifecycle: run - register routes
     */
    run({ http }) {
        var _a;
        // Refresh hooks after all registrations
        this.refreshHooks();
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
        });
        (_a = http === null || http === void 0 ? void 0 : http.routes_leafs) === null || _a === void 0 ? void 0 : _a.push(...this.routes);
        console.log(`[ETHAdminLeaf] Initialized with ${this._collections.size} collections`);
        console.log(`[ETHAdminLeaf] Actions: ${this._actions.list().join(', ') || 'none'}`);
        console.log(`[ETHAdminLeaf] Hooks: ${this._hooks.list().join(', ') || 'none'}`);
    }
    commands() {
        return [];
    }
}
// Re-export types
export * from './features';
