var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// ============================================
// Hook Registry
// ============================================
export class HookRegistry {
    constructor() {
        this.hooks = new Map();
    }
    /**
     * Register a new hook
     */
    register(name, hook) {
        if (this.hooks.has(name)) {
            console.warn(`[HookRegistry] Hook "${name}" already exists, overwriting`);
        }
        this.hooks.set(name, Object.assign({ name }, hook));
        console.log(`[HookRegistry] Registered: ${name} (collection: ${hook.collection})`);
    }
    /**
     * Extend an existing hook
     */
    extend(name, extension) {
        const existing = this.hooks.get(name);
        if (!existing) {
            console.warn(`[HookRegistry] Hook "${name}" not found`);
            return;
        }
        this.hooks.set(name, Object.assign(Object.assign(Object.assign({}, existing), extension), { name: existing.name, collection: existing.collection }));
    }
    /**
     * Check if hook exists
     */
    has(name) {
        return this.hooks.has(name);
    }
    /**
     * Get a hook
     */
    get(name) {
        return this.hooks.get(name);
    }
    /**
     * List all hook names
     */
    list() {
        return Array.from(this.hooks.keys());
    }
    /**
     * Get all hooks for a collection (including '*' hooks)
     */
    getForCollection(collectionName) {
        const hooks = [];
        for (const hook of this.hooks.values()) {
            if (hook.collection === '*' || hook.collection === collectionName) {
                hooks.push(hook);
            }
        }
        return hooks;
    }
    /**
     * Resolve all hooks for a collection into a single set of functions
     * Multiple hooks are chained (first registered runs first)
     */
    resolve(collectionName) {
        const hooks = this.getForCollection(collectionName);
        const resolved = {};
        for (const hook of hooks) {
            // Chain beforeCreate
            if (hook.beforeCreate) {
                const existing = resolved.beforeCreate;
                const newHook = hook.beforeCreate;
                resolved.beforeCreate = existing
                    ? (data, req) => __awaiter(this, void 0, void 0, function* () {
                        const result = yield existing(data, req);
                        return yield newHook(result !== null && result !== void 0 ? result : data, req);
                    })
                    : newHook;
            }
            // Chain afterCreate
            if (hook.afterCreate) {
                const existing = resolved.afterCreate;
                const newHook = hook.afterCreate;
                resolved.afterCreate = existing
                    ? (record, req) => __awaiter(this, void 0, void 0, function* () {
                        yield existing(record, req);
                        yield newHook(record, req);
                    })
                    : newHook;
            }
            // Chain beforeUpdate
            if (hook.beforeUpdate) {
                const existing = resolved.beforeUpdate;
                const newHook = hook.beforeUpdate;
                resolved.beforeUpdate = existing
                    ? (record, data, req) => __awaiter(this, void 0, void 0, function* () {
                        const result = yield existing(record, data, req);
                        return yield newHook(record, result !== null && result !== void 0 ? result : data, req);
                    })
                    : newHook;
            }
            // Chain afterUpdate
            if (hook.afterUpdate) {
                const existing = resolved.afterUpdate;
                const newHook = hook.afterUpdate;
                resolved.afterUpdate = existing
                    ? (record, req) => __awaiter(this, void 0, void 0, function* () {
                        yield existing(record, req);
                        yield newHook(record, req);
                    })
                    : newHook;
            }
            // Chain beforeDelete (all must return true to proceed)
            if (hook.beforeDelete) {
                const existing = resolved.beforeDelete;
                const newHook = hook.beforeDelete;
                resolved.beforeDelete = existing
                    ? (record, req) => __awaiter(this, void 0, void 0, function* () {
                        const canContinue = yield existing(record, req);
                        if (canContinue === false)
                            return false;
                        return yield newHook(record, req);
                    })
                    : newHook;
            }
            // Chain afterDelete
            if (hook.afterDelete) {
                const existing = resolved.afterDelete;
                const newHook = hook.afterDelete;
                resolved.afterDelete = existing
                    ? (record, req) => __awaiter(this, void 0, void 0, function* () {
                        yield existing(record, req);
                        yield newHook(record, req);
                    })
                    : newHook;
            }
        }
        return resolved;
    }
}
