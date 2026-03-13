import { Request } from 'express';
export interface HookFunctions {
    beforeCreate?: (data: any, req: Request) => Promise<any>;
    afterCreate?: (record: any, req: Request) => Promise<void>;
    beforeUpdate?: (record: any, data: any, req: Request) => Promise<any>;
    afterUpdate?: (record: any, req: Request) => Promise<void>;
    beforeDelete?: (record: any, req: Request) => Promise<boolean>;
    afterDelete?: (record: any, req: Request) => Promise<void>;
}
export interface Hook extends HookFunctions {
    name: string;
    collection: string | '*';
    description?: string;
}
export interface ResolvedHooks {
    beforeCreate?: (data: any, req: Request) => Promise<any>;
    afterCreate?: (record: any, req: Request) => Promise<void>;
    beforeUpdate?: (record: any, data: any, req: Request) => Promise<any>;
    afterUpdate?: (record: any, req: Request) => Promise<void>;
    beforeDelete?: (record: any, req: Request) => Promise<boolean>;
    afterDelete?: (record: any, req: Request) => Promise<void>;
}
export declare class HookRegistry {
    private hooks;
    /**
     * Register a new hook
     */
    register(name: string, hook: Omit<Hook, 'name'>): void;
    /**
     * Extend an existing hook
     */
    extend(name: string, extension: Partial<Omit<Hook, 'name' | 'collection'>>): void;
    /**
     * Check if hook exists
     */
    has(name: string): boolean;
    /**
     * Get a hook
     */
    get(name: string): Hook | undefined;
    /**
     * List all hook names
     */
    list(): string[];
    /**
     * Get all hooks for a collection (including '*' hooks)
     */
    getForCollection(collectionName: string): Hook[];
    /**
     * Resolve all hooks for a collection into a single set of functions
     * Multiple hooks are chained (first registered runs first)
     */
    resolve(collectionName: string): ResolvedHooks;
}
