import { Table, TableOptions, Model } from "sequelize-typescript"
import etherial from '../../index'

type RoomTarget = string | "all" | "guests" | "users"

interface ReactiveHookCallbackReturn {
    instance?: Model<any, any>
    users?: (string | number)[]
    rooms?: RoomTarget[]
    /** Skip emitting this event */
    skip?: boolean
}

type HookCallback = (instance: Model<any, any>) => ReactiveHookCallbackReturn | Promise<ReactiveHookCallbackReturn>

interface ReactiveParams {
    /** Called after a record is created */
    onCreate?: (cb: HookCallback) => void
    /** Called after a record is updated */
    onUpdate?: (cb: HookCallback) => void
    /** Called after a record is deleted */
    onDelete?: (cb: HookCallback) => void
    /** Register same callback for create, update, and delete */
    onAll?: (cb: HookCallback) => void
}

interface ReactiveTableOptions extends TableOptions {
    reactive?: (options: ReactiveParams) => void
}

type ActionType = 'create' | 'update' | 'delete'

interface ReactivePayload {
    action: ActionType
    model: string
    data: any
    timestamp: number
}

/**
 * Generate a Sequelize hook that emits reactive events via Socket.io
 */
const generateHook = (cb: HookCallback, type: ActionType) => {
    return async (instance: Model<any, any>) => {
        const reactive = etherial["reactive"]

        // Early exit if reactive module not available
        if (!reactive?.io) return

        try {
            const rtnOptions = await cb(instance)

            // Allow skipping emission
            if (rtnOptions.skip) return

            // Collect all target rooms (flat array)
            const rooms: string[] = [
                ...(rtnOptions.users?.map(id => `user_${id}`) ?? []),
                ...(rtnOptions.rooms ?? [])
            ]

            // Nothing to emit to
            if (rooms.length === 0) return

            // Use provided instance or original
            const targetInstance = rtnOptions.instance ?? instance

            // Build payload
            const payload: ReactivePayload = {
                action: type,
                model: targetInstance.constructor.name,
                data: serializeInstance(targetInstance),
                timestamp: Date.now()
            }

            // Batch emit to all rooms at once (more efficient than looping)
            reactive.io.to(rooms).emit("reactive", payload)

        } catch (error) {
            console.error(`[Reactive] Hook error on ${type} for ${instance.constructor.name}:`, error)
        }
    }
}

/**
 * Safely serialize a Sequelize model instance
 */
const serializeInstance = (instance: Model<any, any>): any => {
    // Prefer toJSON if available (Sequelize models have this)
    if (typeof instance.toJSON === 'function') {
        return instance.toJSON()
    }
    // Fallback to JSON parse/stringify
    return JSON.parse(JSON.stringify(instance))
}

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
export const ReactiveTable = (options: ReactiveTableOptions) => {
    return function (target: Function) {
        // Initialize hooks object if not present
        if (!options.hooks) {
            options.hooks = {}
        }

        if (options.reactive) {
            const hooks = options.hooks

            options.reactive({
                onCreate: (cb) => {
                    hooks.afterCreate = generateHook(cb, "create")
                },
                onUpdate: (cb) => {
                    hooks.afterUpdate = generateHook(cb, "update")
                },
                onDelete: (cb) => {
                    hooks.afterDestroy = generateHook(cb, "delete")
                },
                onAll: (cb) => {
                    hooks.afterCreate = generateHook(cb, "create")
                    hooks.afterUpdate = generateHook(cb, "update")
                    hooks.afterDestroy = generateHook(cb, "delete")
                }
            })

            // Clean up - remove reactive from options before passing to Sequelize
            delete options.reactive
        }

        return Table(options)(target)
    }
}

/**
 * Helper to create reactive options for common patterns
 */
export const ReactiveHelpers = {
    /** Emit to all connected clients */
    toAll: (): ReactiveHookCallbackReturn => ({ rooms: ['all'] }),

    /** Emit to all authenticated users */
    toUsers: (): ReactiveHookCallbackReturn => ({ rooms: ['users'] }),

    /** Emit to specific users */
    toUserIds: (ids: (string | number)[]): ReactiveHookCallbackReturn => ({ users: ids }),

    /** Emit to specific rooms */
    toRooms: (rooms: RoomTarget[]): ReactiveHookCallbackReturn => ({ rooms }),

    /** Skip emission */
    skip: (): ReactiveHookCallbackReturn => ({ skip: true }),
}
