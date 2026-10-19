import { Etherial } from 'etherial';
import { ActionRegistry, CustomFieldTypeConfig } from './features/ActionRegistry.js';
import { HookRegistry, ResolvedHooks } from './features/HookRegistry.js';
import { CollectionConfig, SerializedCollection } from './features/CollectionConfig.js';
import { PageConfig, SerializedPage } from './features/PageConfig.js';
import { LoginJournalConfig } from './features/loginJournal.js';
import { AuditConfig } from './features/audit.js';
import { NotificationsConfig, NotifyInput } from './features/notifications.js';
import { RolesConfig, CollectionPermission } from './features/access.js';
export type AccessChecker = (user: any, context: {
    route: string;
    method: string;
}) => Promise<boolean> | boolean;
export type AdminAccessChecker = (user: any) => Promise<boolean> | boolean;
export interface AdminSettings {
    appName?: string;
    logo?: string;
    favicon?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    textColor?: string;
    footerText?: string;
    copyrightText?: string;
    custom?: Record<string, any>;
    /** How the back-office menu is laid out. */
    navigation?: AdminNavigation;
}
/** A menu group, matched by the `meta.group` the collections and pages declare. */
export interface AdminNavigationGroup {
    name: string;
    /** Shown instead of `name` (which stays the key collections refer to). */
    label?: string;
    /** A lucide icon name, as `meta.icon`. */
    icon?: string;
    /** Closed until opened: reference data one consults rather than works in. */
    collapsed?: boolean;
    /**
     * Left out of the back office's menu, search, "New" menu and dashboard: a
     * part not in use yet. Its screens still open by link.
     */
    hidden?: boolean;
    /**
     * The group's entries in reading order, whatever group they declare: a
     * collection name, a built-in page (`analytics`, `surveys`, `emails`,
     * `email-campaigns`, `notification-texts`, `reactive-monitoring`) or
     * `pages/<name>` for a custom page. The group's other entries follow, in
     * their `meta.order`. Built-in pages no group lists stay above the groups;
     * a group may hold built-in pages only.
     */
    items?: string[];
}
export interface AdminNavigation {
    /**
     * The menu groups in reading order. Groups not listed follow, in the order
     * the collections declaring them were registered.
     */
    groups?: AdminNavigationGroup[];
}
export interface AdminFeatures {
    reactiveMonitoring?: boolean;
    /**
     * Keep a journal of back-office sign-ins (who, when, from where, refused
     * or not), listed in the `admin-logins` collection. Opt-in: the leaf adds
     * an `admin_login_logs` table.
     */
    loginJournal?: boolean | LoginJournalConfig;
    /**
     * Record every change to the records the back-office shows: who made it
     * (a person, Salesforce, the system…), through what, and each column
     * before and after. Shown on each record and in the `admin-audit`
     * collection; an edit can be undone from there. Opt-in: the leaf adds an
     * `admin_audit_logs` table. Name an integration's writes with `withActor()`.
     */
    audit?: boolean | AuditConfig;
    /**
     * The back-office's AI helpers: the assistant, "Fill with AI",
     * auto-translate, the flow generator. Opt-in: what they read is sent to an
     * AI provider, and every request is paid for. Off, the back-office hides
     * them and their routes refuse; a project's own AI routes ask `aiEnabled()`.
     */
    ai?: boolean;
    /**
     * A bell in the back-office header: mentions, flow steps (`admin.notify`)
     * and any code calling `notify()` reach staff there, and by email with
     * `appUrl` set and a mail transport. Opt-in: the leaf adds an
     * `admin_notifications` table.
     */
    notifications?: boolean | NotificationsConfig;
    /**
     * Internal notes on every record, with `@mentions` that notify (through
     * `notifications`, when on). Opt-in: the leaf adds an `admin_notes` table.
     */
    notes?: boolean;
    /**
     * Keep each user's back-office preferences (favorites, saved views,
     * hidden columns…) on their account instead of in one browser. Opt-in: the
     * leaf adds an `admin_preferences` table and the `/admin/prefs` routes.
     */
    preferences?: boolean;
    /**
     * Back-office roles: super admins see everything, staff get what the role
     * linked to their account grants (per collection, page, dashboard and
     * monitoring), configured from an `admin-roles` collection. The leaf
     * installs the access checkers (a project may still replace them) and gates
     * every route under its prefix. Opt-in: the leaf adds an `admin_roles`
     * table; the users table needs the role id column.
     */
    roles?: boolean | RolesConfig;
}
export interface ETHAdminLeafConfig {
    prefix?: string;
    settings?: AdminSettings;
    features?: AdminFeatures;
    /**
     * Columns never sent back by the collection routes, on top of the
     * credentials the leaf always holds back (`password`, the reset and
     * confirmation tokens).
     */
    secretColumns?: string[];
}
export default class ETHAdminLeaf {
    readonly etherial_module_name = "eth_admin_leaf";
    private _accessChecker?;
    private _adminAccessChecker?;
    private _config;
    private _collections;
    private _resolvedHooks;
    private _pages;
    private _customFieldTypes;
    private _pageFormHandlers;
    private _settings;
    private _features;
    private _actions;
    private _hooks;
    private routes;
    constructor(config?: ETHAdminLeafConfig);
    /**
     * Action Registry - for user-triggered actions (buttons)
     */
    get actions(): ActionRegistry;
    /**
     * Hook Registry - for CRUD lifecycle hooks
     */
    get hooks(): HookRegistry;
    /**
     * Register a collection for admin CRUD
     */
    registerCollection(config: CollectionConfig): void;
    /**
     * Get a registered collection by name
     */
    getCollection(name: string): CollectionConfig | undefined;
    /**
     * Get resolved hooks for a collection
     */
    getResolvedHooks(name: string): ResolvedHooks | undefined;
    /**
     * Re-resolve hooks (call after registering new hooks)
     */
    refreshHooks(): void;
    /**
     * Register a custom page
     */
    registerPage(config: PageConfig): void;
    /**
     * Get a registered page by name
     */
    getPage(name: string): PageConfig | undefined;
    /**
     * Serialize all pages for frontend
     */
    serializePages(): SerializedPage[];
    /**
     * Register a custom field type with optional hooks
     */
    registerFieldType(name: string, config?: Omit<CustomFieldTypeConfig, 'name'>): void;
    /**
     * Get a custom field type config
     */
    getCustomFieldType(name: string): CustomFieldTypeConfig | undefined;
    /**
     * Get all custom field type names
     */
    getCustomFieldTypeNames(): string[];
    /**
     * Register a handler for a page form submission
     */
    registerPageFormHandler(pageName: string, handler: (data: any, req: any) => Promise<any>): void;
    /**
     * Get a page form handler
     */
    getPageFormHandler(pageName: string): ((data: any, req: any) => Promise<any>) | undefined;
    /**
     * Get all registered collections
     */
    get collections(): CollectionConfig[];
    /**
     * Serialize a collection for frontend
     */
    serializeCollection(name: string): SerializedCollection | null;
    /**
     * Serialize all collections for frontend
     */
    serializeCollections(): SerializedCollection[];
    /**
     * Get the full admin schema for frontend
     */
    getSchema(): {
        settings: AdminSettings;
        features: AdminFeatures;
        collections: SerializedCollection[];
        pages: SerializedPage[];
        customFieldTypes: string[];
        media?: {
            cdnUrl?: string;
        };
    };
    /**
     * Set access checker for route-level permissions
     */
    setAccessChecker(checker: AccessChecker): void;
    get accessChecker(): AccessChecker | undefined;
    /**
     * Set admin access checker for panel-level access
     */
    setAdminAccessChecker(checker: AdminAccessChecker): void;
    get adminAccessChecker(): AdminAccessChecker | undefined;
    /**
     * Check if a user can access the admin panel
     */
    canAccessAdmin(user: any): Promise<boolean>;
    /**
     * Check if a user can access a specific route/method
     */
    checkAccess(user: any, route: string, method: string): Promise<boolean>;
    /** Whether `user` may run `method` (a CRUD step or an action name) on a collection. */
    canAccess(user: any, collection: string, method: string): Promise<boolean>;
    /** Everything allowed: a super admin with roles, anyone let in without. */
    isSuperAdmin(user: any): Promise<boolean>;
    /** The accounts that can open the back-office, optionally only those holding a permission. */
    listAdminUsers(filter?: {
        collection?: string;
        permission?: CollectionPermission;
    }): Promise<any[]>;
    /** The columns a create or update from the back-office may set. */
    writableFields(collection: CollectionConfig, user: any): Promise<Set<string>>;
    /**
     * May the user open a collection's records (not only pick them in a
     * relation)? Export, stats and counts need this.
     */
    canViewCollection(user: any, collection: string): Promise<boolean>;
    canAccessPageFor(user: any, name: string): Promise<boolean>;
    /** The dashboard's stats: with roles, a permission of its own. */
    canSeeDashboardFor(user: any): Promise<boolean>;
    /** Live monitoring: with roles, a permission of its own. */
    canSeeMonitoringFor(user: any): Promise<boolean>;
    /**
     * A collection as `user` sees it in the schema. Null when they cannot list
     * it. Listed but not opened, it is a lookup (the target of a relation they
     * work with): out of the menu, list only, so pickers and filters resolve.
     * Otherwise it keeps the CRUD steps and actions they may use.
     */
    serializeCollectionFor(user: any, name: string): Promise<SerializedCollection | null>;
    /** The schema as `user` may see it: collections, pages and features they can reach. */
    getSchemaFor(user: any): Promise<ReturnType<ETHAdminLeaf['getSchema']> & {
        canSeeDashboard?: boolean;
    }>;
    get config(): ETHAdminLeafConfig;
    get settings(): AdminSettings;
    get features(): AdminFeatures;
    /**
     * What the back-office needs to know about the features: whether each one
     * is on, never its server-side configuration.
     */
    publicFeatures(): Record<string, any>;
    /** Whether the project turned the back-office's AI helpers on (`features.ai`). */
    aiEnabled(): boolean;
    private _leafFeatures;
    private _auditedCollections;
    /**
     * Another leaf announcing what it adds to the back-office (Pulse's
     * communications timeline…). Only what the front needs: never secrets.
     */
    setFeature(name: string, value: unknown): void;
    /**
     * Lifecycle: beforeRun - hand the leaf's own tables to the database before
     * it syncs. Only the features turned on add a table.
     */
    beforeRun({ database }: Etherial): void;
    /**
     * Lifecycle: run - register routes
     */
    run({ http }: Etherial): void;
    /**
     * Lifecycle: afterRun - every model and collection of the project exists
     * now, so the journal can join its rows to the user model and link them
     * to the users collection.
     */
    afterRun(): void;
    /**
     * Notifies back-office users: see `NotifyInput` for who. Resolves with the
     * number of notifications created, 0 while `features.notifications` is off.
     */
    notify(input: NotifyInput): Promise<number>;
    /** Whether `features.notifications` is on and `notify()` reaches anyone. */
    notificationsEnabled(): boolean;
    commands(): any[];
}
export * from './features/index.js';
