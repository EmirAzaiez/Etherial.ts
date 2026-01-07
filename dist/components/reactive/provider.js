var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Table } from "sequelize-typescript";
import etherial from '../../index.js';
/**
 * Generate a Sequelize hook that emits reactive events via Socket.io
 */
const generateHook = (cb, type) => {
    return (instance) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const reactive = etherial["reactive"];
        // Early exit if reactive module not available
        if (!(reactive === null || reactive === void 0 ? void 0 : reactive.io))
            return;
        try {
            const rtnOptions = yield cb(instance);
            // Allow skipping emission
            if (rtnOptions.skip)
                return;
            // Collect all target rooms (flat array)
            const rooms = [
                ...((_b = (_a = rtnOptions.users) === null || _a === void 0 ? void 0 : _a.map(id => `user_${id}`)) !== null && _b !== void 0 ? _b : []),
                ...((_c = rtnOptions.rooms) !== null && _c !== void 0 ? _c : [])
            ];
            // Nothing to emit to
            if (rooms.length === 0)
                return;
            // Use provided instance or original
            const targetInstance = (_d = rtnOptions.instance) !== null && _d !== void 0 ? _d : instance;
            // Build payload
            const payload = {
                action: type,
                model: targetInstance.constructor.name,
                data: serializeInstance(targetInstance),
                timestamp: Date.now()
            };
            // Batch emit to all rooms at once (more efficient than looping)
            reactive.io.to(rooms).emit("reactive", payload);
        }
        catch (error) {
            console.error(`[Reactive] Hook error on ${type} for ${instance.constructor.name}:`, error);
        }
    });
};
/**
 * Safely serialize a Sequelize model instance
 */
const serializeInstance = (instance) => {
    // Prefer toJSON if available (Sequelize models have this)
    if (typeof instance.toJSON === 'function') {
        return instance.toJSON();
    }
    // Fallback to JSON parse/stringify
    return JSON.parse(JSON.stringify(instance));
};
/**
 * Decorator that extends @Table with reactive capabilities.
 * Automatically emits Socket.io events when records are created, updated, or deleted.
 *
 * @example
 * ```typescript
 * @ReactiveTable({
 *   tableName: 'messages',
 *   reactive: ({ onCreate, onUpdate, onDelete }) => {
 *     onCreate((instance) => ({
 *       rooms: ['all'],
 *       users: [instance.userId]
 *     }))
 *
 *     onUpdate((instance) => ({
 *       rooms: [`conversation_${instance.conversationId}`]
 *     }))
 *
 *     onDelete((instance) => ({
 *       rooms: ['all'],
 *       skip: instance.isPrivate // Skip emission for private messages
 *     }))
 *   }
 * })
 * export class Message extends Model { ... }
 * ```
 */
export const ReactiveTable = (options) => {
    return function (target) {
        // Initialize hooks object if not present
        if (!options.hooks) {
            options.hooks = {};
        }
        if (options.reactive) {
            const hooks = options.hooks;
            options.reactive({
                onCreate: (cb) => {
                    hooks.afterCreate = generateHook(cb, "create");
                },
                onUpdate: (cb) => {
                    hooks.afterUpdate = generateHook(cb, "update");
                },
                onDelete: (cb) => {
                    hooks.afterDestroy = generateHook(cb, "delete");
                },
                onAll: (cb) => {
                    hooks.afterCreate = generateHook(cb, "create");
                    hooks.afterUpdate = generateHook(cb, "update");
                    hooks.afterDestroy = generateHook(cb, "delete");
                }
            });
            // Clean up - remove reactive from options before passing to Sequelize
            delete options.reactive;
        }
        return Table(options)(target);
    };
};
/**
 * Helper to create reactive options for common patterns
 */
export const ReactiveHelpers = {
    /** Emit to all connected clients */
    toAll: () => ({ rooms: ['all'] }),
    /** Emit to all authenticated users */
    toUsers: () => ({ rooms: ['users'] }),
    /** Emit to specific users */
    toUserIds: (ids) => ({ users: ids }),
    /** Emit to specific rooms */
    toRooms: (rooms) => ({ rooms }),
    /** Skip emission */
    skip: () => ({ skip: true }),
};
