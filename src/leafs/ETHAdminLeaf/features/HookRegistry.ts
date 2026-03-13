import { Request } from 'express'

// ============================================
// Hook Types
// ============================================

export interface HookFunctions {
    beforeCreate?: (data: any, req: Request) => Promise<any>
    afterCreate?: (record: any, req: Request) => Promise<void>
    beforeUpdate?: (record: any, data: any, req: Request) => Promise<any>
    afterUpdate?: (record: any, req: Request) => Promise<void>
    beforeDelete?: (record: any, req: Request) => Promise<boolean>
    afterDelete?: (record: any, req: Request) => Promise<void>
}

export interface Hook extends HookFunctions {
    name: string
    collection: string | '*'  // '*' = all collections
    description?: string
}

export interface ResolvedHooks {
    beforeCreate?: (data: any, req: Request) => Promise<any>
    afterCreate?: (record: any, req: Request) => Promise<void>
    beforeUpdate?: (record: any, data: any, req: Request) => Promise<any>
    afterUpdate?: (record: any, req: Request) => Promise<void>
    beforeDelete?: (record: any, req: Request) => Promise<boolean>
    afterDelete?: (record: any, req: Request) => Promise<void>
}

// ============================================
// Hook Registry
// ============================================

export class HookRegistry {
    private hooks: Map<string, Hook> = new Map()

    /**
     * Register a new hook
     */
    register(name: string, hook: Omit<Hook, 'name'>): void {
        if (this.hooks.has(name)) {
            console.warn(`[HookRegistry] Hook "${name}" already exists, overwriting`)
        }
        this.hooks.set(name, { name, ...hook })
        console.log(`[HookRegistry] Registered: ${name} (collection: ${hook.collection})`)
    }

    /**
     * Extend an existing hook
     */
    extend(name: string, extension: Partial<Omit<Hook, 'name' | 'collection'>>): void {
        const existing = this.hooks.get(name)
        if (!existing) {
            console.warn(`[HookRegistry] Hook "${name}" not found`)
            return
        }

        this.hooks.set(name, {
            ...existing,
            ...extension,
            name: existing.name,
            collection: existing.collection
        })
    }

    /**
     * Check if hook exists
     */
    has(name: string): boolean {
        return this.hooks.has(name)
    }

    /**
     * Get a hook
     */
    get(name: string): Hook | undefined {
        return this.hooks.get(name)
    }

    /**
     * List all hook names
     */
    list(): string[] {
        return Array.from(this.hooks.keys())
    }

    /**
     * Get all hooks for a collection (including '*' hooks)
     */
    getForCollection(collectionName: string): Hook[] {
        const hooks: Hook[] = []
        for (const hook of this.hooks.values()) {
            if (hook.collection === '*' || hook.collection === collectionName) {
                hooks.push(hook)
            }
        }
        return hooks
    }

    /**
     * Resolve all hooks for a collection into a single set of functions
     * Multiple hooks are chained (first registered runs first)
     */
    resolve(collectionName: string): ResolvedHooks {
        const hooks = this.getForCollection(collectionName)
        const resolved: ResolvedHooks = {}

        for (const hook of hooks) {
            // Chain beforeCreate
            if (hook.beforeCreate) {
                const existing = resolved.beforeCreate
                const newHook = hook.beforeCreate
                resolved.beforeCreate = existing
                    ? async (data, req) => {
                        const result = await existing(data, req)
                        return await newHook(result ?? data, req)
                    }
                    : newHook
            }

            // Chain afterCreate
            if (hook.afterCreate) {
                const existing = resolved.afterCreate
                const newHook = hook.afterCreate
                resolved.afterCreate = existing
                    ? async (record, req) => {
                        await existing(record, req)
                        await newHook(record, req)
                    }
                    : newHook
            }

            // Chain beforeUpdate
            if (hook.beforeUpdate) {
                const existing = resolved.beforeUpdate
                const newHook = hook.beforeUpdate
                resolved.beforeUpdate = existing
                    ? async (record, data, req) => {
                        const result = await existing(record, data, req)
                        return await newHook(record, result ?? data, req)
                    }
                    : newHook
            }

            // Chain afterUpdate
            if (hook.afterUpdate) {
                const existing = resolved.afterUpdate
                const newHook = hook.afterUpdate
                resolved.afterUpdate = existing
                    ? async (record, req) => {
                        await existing(record, req)
                        await newHook(record, req)
                    }
                    : newHook
            }

            // Chain beforeDelete (all must return true to proceed)
            if (hook.beforeDelete) {
                const existing = resolved.beforeDelete
                const newHook = hook.beforeDelete
                resolved.beforeDelete = existing
                    ? async (record, req) => {
                        const canContinue = await existing(record, req)
                        if (canContinue === false) return false
                        return await newHook(record, req)
                    }
                    : newHook
            }

            // Chain afterDelete
            if (hook.afterDelete) {
                const existing = resolved.afterDelete
                const newHook = hook.afterDelete
                resolved.afterDelete = existing
                    ? async (record, req) => {
                        await existing(record, req)
                        await newHook(record, req)
                    }
                    : newHook
            }
        }

        return resolved
    }
}
