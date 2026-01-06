import { TableOptions, Model } from "sequelize-typescript";
type RoomTarget = string | "all" | "guests" | "users";
interface ReactiveHookCallbackReturn {
    instance?: Model<any, any>;
    users?: (string | number)[];
    rooms?: RoomTarget[];
    /** Skip emitting this event */
    skip?: boolean;
}
type HookCallback = (instance: Model<any, any>) => ReactiveHookCallbackReturn | Promise<ReactiveHookCallbackReturn>;
interface ReactiveParams {
    /** Called after a record is created */
    onCreate?: (cb: HookCallback) => void;
    /** Called after a record is updated */
    onUpdate?: (cb: HookCallback) => void;
    /** Called after a record is deleted */
    onDelete?: (cb: HookCallback) => void;
    /** Register same callback for create, update, and delete */
    onAll?: (cb: HookCallback) => void;
}
interface ReactiveTableOptions extends TableOptions {
    reactive?: (options: ReactiveParams) => void;
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
export declare const ReactiveTable: (options: ReactiveTableOptions) => (target: Function) => any;
/**
 * Helper to create reactive options for common patterns
 */
export declare const ReactiveHelpers: {
    /** Emit to all connected clients */
    toAll: () => ReactiveHookCallbackReturn;
    /** Emit to all authenticated users */
    toUsers: () => ReactiveHookCallbackReturn;
    /** Emit to specific users */
    toUserIds: (ids: (string | number)[]) => ReactiveHookCallbackReturn;
    /** Emit to specific rooms */
    toRooms: (rooms: RoomTarget[]) => ReactiveHookCallbackReturn;
    /** Skip emission */
    skip: () => ReactiveHookCallbackReturn;
};
export {};
