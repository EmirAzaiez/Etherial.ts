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
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { ActionRegistry } from './features/ActionRegistry.js';
import { HookRegistry } from './features/HookRegistry.js';
import { LOGIN_JOURNAL_COLLECTION, loginJournalOptions, loginJournalMiddleware, loginJournalCollection, linkLoginJournalToUsers, } from './features/loginJournal.js';
import { AdminLoginLog } from './models/AdminLoginLog.js';
import { AUDIT_COLLECTION, auditOptions, auditContextMiddleware, auditCollection, installAuditHooks, linkAuditToUsers, scheduleAuditRetention, } from './features/audit.js';
import { AdminAuditLog } from './models/AdminAuditLog.js';
import { AdminPreference } from './models/AdminPreference.js';
import { notificationsOptions, configureNotifications, notifyAdmins, scheduleNotificationJobs, } from './features/notifications.js';
import { AdminNotification } from './models/AdminNotification.js';
import { AdminNote } from './models/AdminNote.js';
import { ADMIN_ROLES_COLLECTION, rolesOptions, configureRoles, rolesConfig, resolveAccess, canAccessCollection, canAccessPage, canSeeDashboard, canSeeMonitoring, isSuperAdmin, listAdminUsers, writableFields, configureSecretColumns, secretsMiddleware, rolesGateMiddleware, linkRolesToUsers, adminRolesCollection, } from './features/access.js';
import { AdminRole } from './models/AdminRole.js';
export default class ETHAdminLeaf {
    constructor(config = {}) {
        this.etherial_module_name = 'eth_admin_leaf';
        this._collections = new Map();
        this._resolvedHooks = new Map();
        this._pages = new Map();
        this._customFieldTypes = new Map();
        this._pageFormHandlers = new Map();
        this._settings = {};
        this._features = {};
        this.routes = [];
        this._leafFeatures = {};
        this._auditedCollections = [];
        this._config = Object.assign({ prefix: '/admin' }, config);
        this._settings = config.settings || {};
        this._features = config.features || {};
        this._actions = new ActionRegistry();
        this._hooks = new HookRegistry();
        configureSecretColumns(config.secretColumns);
        // Installed now so a project setting its own checkers later wins.
        const roles = rolesOptions(this._features.roles);
        configureRoles(roles);
        if (roles) {
            this._adminAccessChecker = (user) => __awaiter(this, void 0, void 0, function* () { return !!(yield resolveAccess(user)); });
            this._accessChecker = (user_1, _a) => __awaiter(this, [user_1, _a], void 0, function* (user, { route, method }) {
                if (!route) {
                    return false;
                }
                return canAccessCollection(yield resolveAccess(user), route, method || 'list');
            });
        }
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
        // Global search (the command palette): only reads what the user may list
        this.routes.push({
            route: path.join(__dirname, 'routes/search'),
            methods: ['search']
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
    // ============================================
    // Custom Pages
    // ============================================
    /**
     * Register a custom page
     */
    registerPage(config) {
        if (this._pages.has(config.name)) {
            console.warn(`[ETHAdminLeaf] Page "${config.name}" already registered, overwriting`);
        }
        this._pages.set(config.name, config);
        console.log(`[ETHAdminLeaf] Registered page: ${config.name}`);
    }
    /**
     * Get a registered page by name
     */
    getPage(name) {
        return this._pages.get(name);
    }
    /**
     * Serialize all pages for frontend
     */
    serializePages() {
        const result = [];
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
            });
        }
        return result;
    }
    // ============================================
    // Custom Field Types
    // ============================================
    /**
     * Register a custom field type with optional hooks
     */
    registerFieldType(name, config) {
        if (this._customFieldTypes.has(name)) {
            console.warn(`[ETHAdminLeaf] Custom field type "${name}" already registered, overwriting`);
        }
        this._customFieldTypes.set(name, Object.assign({ name }, config));
        console.log(`[ETHAdminLeaf] Registered custom field type: ${name}`);
    }
    /**
     * Get a custom field type config
     */
    getCustomFieldType(name) {
        return this._customFieldTypes.get(name);
    }
    /**
     * Get all custom field type names
     */
    getCustomFieldTypeNames() {
        return Array.from(this._customFieldTypes.keys());
    }
    // ============================================
    // Page Form Handlers
    // ============================================
    /**
     * Register a handler for a page form submission
     */
    registerPageFormHandler(pageName, handler) {
        this._pageFormHandlers.set(pageName, handler);
        console.log(`[ETHAdminLeaf] Registered form handler for page: ${pageName}`);
    }
    /**
     * Get a page form handler
     */
    getPageFormHandler(pageName) {
        return this._pageFormHandlers.get(pageName);
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
            stats: collection.stats,
            exportable: collection.exportable,
            softDelete: collection.softDelete,
            assistants: collection.assistants
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
            features: this.publicFeatures(),
            collections: this.serializeCollections(),
            pages: this.serializePages(),
            customFieldTypes: this.getCustomFieldTypeNames(),
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
    /** Whether `user` may run `method` (a CRUD step or an action name) on a collection. */
    canAccess(user, collection, method) {
        return this.checkAccess(user, collection, method);
    }
    /** Everything allowed: a super admin with roles, anyone let in without. */
    isSuperAdmin(user) {
        return isSuperAdmin(user);
    }
    /** The accounts that can open the back-office, optionally only those holding a permission. */
    listAdminUsers(filter) {
        return listAdminUsers(filter);
    }
    /** The columns a create or update from the back-office may set. */
    writableFields(collection, user) {
        return writableFields(collection, user);
    }
    /**
     * May the user open a collection's records (not only pick them in a
     * relation)? Export, stats and counts need this.
     */
    canViewCollection(user, collection) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.checkAccess(user, collection, 'list')) && (yield this.checkAccess(user, collection, 'show'));
        });
    }
    canAccessPageFor(user, name) {
        return __awaiter(this, void 0, void 0, function* () {
            const page = this._pages.get(name);
            if (!page) {
                return false;
            }
            if (rolesConfig() && !canAccessPage(yield resolveAccess(user), name)) {
                return false;
            }
            if (typeof page.canAccess === 'function') {
                try {
                    return !!(yield page.canAccess(user));
                }
                catch (_a) {
                    return false;
                }
            }
            return true;
        });
    }
    /** The dashboard's stats: with roles, a permission of its own. */
    canSeeDashboardFor(user) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!rolesConfig()) {
                return this.canAccessAdmin(user);
            }
            return canSeeDashboard(yield resolveAccess(user));
        });
    }
    /** Live monitoring: with roles, a permission of its own. */
    canSeeMonitoringFor(user) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!rolesConfig()) {
                return this.canAccessAdmin(user);
            }
            return canSeeMonitoring(yield resolveAccess(user));
        });
    }
    /**
     * A collection as `user` sees it in the schema. Null when they cannot list
     * it. Listed but not opened, it is a lookup (the target of a relation they
     * work with): out of the menu, list only, so pickers and filters resolve.
     * Otherwise it keeps the CRUD steps and actions they may use.
     */
    serializeCollectionFor(user, name) {
        return __awaiter(this, void 0, void 0, function* () {
            const serialized = this.serializeCollection(name);
            if (!serialized) {
                return null;
            }
            if (!(yield this.checkAccess(user, name, 'list'))) {
                return null;
            }
            if (!(yield this.checkAccess(user, name, 'show'))) {
                return Object.assign(Object.assign({}, serialized), { crud: ['list'], actions: [], showInMenu: false, showInDashboard: false });
            }
            const crud = [];
            for (const step of serialized.crud) {
                if (yield this.checkAccess(user, name, step)) {
                    crud.push(step);
                }
            }
            const actions = [];
            for (const action of serialized.actions || []) {
                if (yield this.checkAccess(user, name, action.name)) {
                    actions.push(action);
                }
            }
            return Object.assign(Object.assign({}, serialized), { crud, actions });
        });
    }
    /** The schema as `user` may see it: collections, pages and features they can reach. */
    getSchemaFor(user) {
        return __awaiter(this, void 0, void 0, function* () {
            const schema = this.getSchema();
            const collections = [];
            for (const collection of schema.collections) {
                const visible = yield this.serializeCollectionFor(user, collection.name);
                if (visible) {
                    collections.push(visible);
                }
            }
            const pages = [];
            for (const page of schema.pages) {
                if (yield this.canAccessPageFor(user, page.name)) {
                    pages.push(page);
                }
            }
            // Without roles the back-office shows the dashboard and monitoring to
            // anyone it lets in, as before.
            if (!rolesConfig()) {
                return Object.assign(Object.assign({}, schema), { collections, pages });
            }
            const access = yield resolveAccess(user);
            return Object.assign(Object.assign({}, schema), { collections,
                pages, features: Object.assign(Object.assign({}, schema.features), { reactiveMonitoring: !!schema.features.reactiveMonitoring && canSeeMonitoring(access) }), canSeeDashboard: canSeeDashboard(access) });
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
     * What the back-office needs to know about the features: whether each one
     * is on, never its server-side configuration.
     */
    publicFeatures() {
        var _a;
        const _b = this._features, { loginJournal, audit, ai, notifications, notes } = _b, rest = __rest(_b, ["loginJournal", "audit", "ai", "notifications", "notes"]);
        const auditConfig = auditOptions(audit);
        return Object.assign(Object.assign(Object.assign({}, rest), this._leafFeatures), { loginJournal: loginJournal ? { collection: LOGIN_JOURNAL_COLLECTION } : false, audit: auditConfig
                ? {
                    collection: AUDIT_COLLECTION,
                    collections: this._auditedCollections,
                    usersCollection: (_a = auditConfig.usersCollection) !== null && _a !== void 0 ? _a : 'users',
                }
                : false, ai: this.aiEnabled(), notifications: notificationsOptions(notifications) ? { enabled: true } : false, notes: notes === true, preferences: this._features.preferences === true, roles: !!rolesConfig() });
    }
    /** Whether the project turned the back-office's AI helpers on (`features.ai`). */
    aiEnabled() {
        return this._features.ai === true;
    }
    /**
     * Another leaf announcing what it adds to the back-office (Pulse's
     * communications timeline…). Only what the front needs: never secrets.
     */
    setFeature(name, value) {
        this._leafFeatures[name] = value;
    }
    /**
     * Lifecycle: beforeRun - hand the leaf's own tables to the database before
     * it syncs. Only the features turned on add a table.
     */
    beforeRun({ database }) {
        if (loginJournalOptions(this._features.loginJournal)) {
            database === null || database === void 0 ? void 0 : database.addModels([AdminLoginLog]);
        }
        if (auditOptions(this._features.audit)) {
            database === null || database === void 0 ? void 0 : database.addModels([AdminAuditLog]);
        }
        const notifications = notificationsOptions(this._features.notifications);
        if (notifications) {
            database === null || database === void 0 ? void 0 : database.addModels([AdminNotification]);
            configureNotifications(notifications);
        }
        if (this._features.notes === true) {
            database === null || database === void 0 ? void 0 : database.addModels([AdminNote]);
        }
        if (this._features.preferences === true) {
            database === null || database === void 0 ? void 0 : database.addModels([AdminPreference]);
        }
        if (rolesConfig()) {
            database === null || database === void 0 ? void 0 : database.addModels([AdminRole]);
        }
    }
    /**
     * Lifecycle: run - register routes
     */
    run({ http }) {
        var _a, _b, _c, _d;
        // Refresh hooks after all registrations
        this.refreshHooks();
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
        });
        // Register pages route - always, for the same reason as collections:
        // the leaf's run() fires before the application's, so pages declared
        // from App.run() are still unknown here. Guarding on _pages.size meant
        // the route silently did not exist and every submit answered a plain
        // 404, with the page itself listed in the schema. With no page
        // registered the route is harmless — it answers 'page_not_found'.
        this.routes.push({
            route: path.join(__dirname, 'routes/pages'),
            methods: ['submitForm']
        });
        const audit = auditOptions(this._features.audit);
        if (audit) {
            this.routes.push({
                route: path.join(__dirname, 'routes/audit'),
                methods: ['history', 'restore']
            });
        }
        if (this._features.preferences === true) {
            this.routes.push({
                route: path.join(__dirname, 'routes/prefs'),
                methods: ['list', 'put', 'remove']
            });
        }
        if (notificationsOptions(this._features.notifications)) {
            this.routes.push({
                route: path.join(__dirname, 'routes/notifications'),
                methods: ['list', 'unreadCount', 'markRead', 'markAllRead']
            });
        }
        // `mentionable` is declared before `:collection/:id` in the controller.
        if (this._features.notes === true) {
            this.routes.push({
                route: path.join(__dirname, 'routes/notes'),
                methods: ['mentionable', 'list', 'create', 'update', 'remove']
            });
        }
        (_a = http === null || http === void 0 ? void 0 : http.routes_leafs) === null || _a === void 0 ? void 0 : _a.push(...this.routes);
        // Mounted now, before any controller: http.listen() registers the
        // routes later, so the journal sees the login's answer go out.
        const journal = loginJournalOptions(this._features.loginJournal);
        if (journal && (http === null || http === void 0 ? void 0 : http.app)) {
            http.app.use(loginJournalMiddleware(journal));
            console.log('[ETHAdminLeaf] Login journal enabled');
        }
        // Opened before any controller, so every write a request makes knows who made it.
        if (audit && (http === null || http === void 0 ? void 0 : http.app)) {
            http.app.use(auditContextMiddleware(audit, (_b = this._config.prefix) !== null && _b !== void 0 ? _b : '/admin'));
        }
        // Whatever the collection and whoever asks, records go out without
        // their credentials.
        const prefix = (_c = this._config.prefix) !== null && _c !== void 0 ? _c : '/admin';
        if (http === null || http === void 0 ? void 0 : http.app) {
            http.app.use(`${prefix}/collections`, secretsMiddleware());
            http.app.use(`${prefix}/relation-options`, secretsMiddleware());
        }
        if (rolesConfig()) {
            // Before the project syncs (in its own run or afterRun).
            if (!linkRolesToUsers()) {
                console.warn(`[ETHAdminLeaf] Roles: no "${(_d = rolesConfig()) === null || _d === void 0 ? void 0 : _d.usersModel}" model, users are not linked to their role`);
            }
            // After the app's cors and body parsers: a preflight must still get its headers.
            http === null || http === void 0 ? void 0 : http.beforeRoutes(rolesGateMiddleware(prefix));
            console.log('[ETHAdminLeaf] Roles enabled');
        }
        console.log(`[ETHAdminLeaf] Initialized with ${this._collections.size} collections, ${this._pages.size} pages, ${this._customFieldTypes.size} custom field types`);
        console.log(`[ETHAdminLeaf] Actions: ${this._actions.list().join(', ') || 'none'}`);
        console.log(`[ETHAdminLeaf] Hooks: ${this._hooks.list().join(', ') || 'none'}`);
    }
    /**
     * Lifecycle: afterRun - every model and collection of the project exists
     * now, so the journal can join its rows to the user model and link them
     * to the users collection.
     */
    afterRun() {
        var _a, _b;
        if (rolesConfig() && !this._collections.has(ADMIN_ROLES_COLLECTION)) {
            this.registerCollection(adminRolesCollection());
        }
        const journal = loginJournalOptions(this._features.loginJournal);
        if (journal && !this._collections.has(LOGIN_JOURNAL_COLLECTION)) {
            const linked = linkLoginJournalToUsers(journal);
            const hasUsers = this._collections.has((_a = journal.usersCollection) !== null && _a !== void 0 ? _a : 'users');
            this.registerCollection(loginJournalCollection(journal, hasUsers, linked));
        }
        const audit = auditOptions(this._features.audit);
        if (audit && !this._collections.has(AUDIT_COLLECTION)) {
            this._auditedCollections = installAuditHooks(Array.from(this._collections.values()), audit);
            const linked = linkAuditToUsers(audit);
            const hasUsers = this._collections.has((_b = audit.usersCollection) !== null && _b !== void 0 ? _b : 'users');
            this.registerCollection(auditCollection(audit, this._auditedCollections, hasUsers, linked));
            scheduleAuditRetention(audit);
            console.log(`[ETHAdminLeaf] Change history on ${this._auditedCollections.length} collections`);
        }
        // Started once the tables are synced: the purge and the digest query them.
        const notifications = notificationsOptions(this._features.notifications);
        if (notifications) {
            scheduleNotificationJobs();
            console.log(`[ETHAdminLeaf] Notifications enabled${notifications.appUrl ? '' : ' (no appUrl: no emails)'}`);
        }
    }
    /**
     * Notifies back-office users: see `NotifyInput` for who. Resolves with the
     * number of notifications created, 0 while `features.notifications` is off.
     */
    notify(input) {
        return notifyAdmins(input);
    }
    /** Whether `features.notifications` is on and `notify()` reaches anyone. */
    notificationsEnabled() {
        return !!notificationsOptions(this._features.notifications);
    }
    commands() {
        return [];
    }
}
// Re-export types
export * from './features/index.js';
