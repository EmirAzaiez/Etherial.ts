import { Etherial } from 'etherial';
import { ActionRegistry, CustomFieldTypeConfig } from './features/ActionRegistry.js';
import { HookRegistry, ResolvedHooks } from './features/HookRegistry.js';
import { CollectionConfig, SerializedCollection } from './features/CollectionConfig.js';
import { PageConfig, SerializedPage } from './features/PageConfig.js';
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
}
export interface AdminFeatures {
    reactiveMonitoring?: boolean;
}
export interface ETHAdminLeafConfig {
    prefix?: string;
    settings?: AdminSettings;
    features?: AdminFeatures;
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
    get config(): ETHAdminLeafConfig;
    get settings(): AdminSettings;
    get features(): AdminFeatures;
    /**
     * Lifecycle: run - register routes
     */
    run({ http }: Etherial): void;
    commands(): any[];
}
export * from './features/index.js';
