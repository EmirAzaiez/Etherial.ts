import { Model } from 'etherial/components/database/provider';
import type { PushResult } from '../providers/push/index.js';
/**
 * ETHPulseLeaf User Mixin
 *
 * This mixin provides messaging methods (push, sms, email) to any User model.
 *
 * Usage in your project's User.ts:
 * ```typescript
 * import { UserLeafBase } from './ETHUserLeaf/models/User.js'
 * import { applyPulseMixin, PulseUserMethods } from './ETHPulseLeaf/models_mixins/UserPulseMixin.js'
 *
 * @Table({ tableName: 'users' })
 * export class User extends applyPulseMixin(UserLeafBase) {
 *     // Your custom fields and methods
 * }
 * ```
 *
 * Then you can use:
 * ```typescript
 * await user.sendPushNotification('Hello', 'World')
 * await user.sendSms('Your code is 1234')
 * await user.sendEmail('Welcome!', { title: 'Welcome', body: '<p>Hi!</p>' })
 * ```
 */
export interface PulseResult {
    success: boolean;
    error?: string;
    messageId?: string;
}
export interface PulseUserMethods {
    /**
     * Send push notification to all user's devices
     * @param title - Notification title
     * @param body - Notification body
     * @param data - Optional data payload
     * @param providerName - Optional provider name (defaults to configured default)
     */
    sendPushNotification(params: {
        title: string;
        body: string;
        data?: Record<string, any>;
    }, providerName?: string): Promise<PushResult[]>;
    /**
     * Send SMS to user's phone number
     * Requires the user to have a 'phone' property
     * @param params - SMS parameters (message)
     * @param providerName - Optional provider name (defaults to configured default)
     */
    sendSms(params: {
        message: string;
    }, providerName?: string): Promise<PulseResult>;
    /**
     * Send transactional email to user
     * Requires the user to have an 'email' property
     * @param params - Email parameters (subject, content)
     * @param providerName - Optional provider name (defaults to configured default)
     */
    sendEmail(params: {
        subject: string;
        content: {
            title?: string;
            greeting?: string;
            body: string;
            footer?: string;
        };
    }, providerName?: string): Promise<PulseResult>;
}
type Constructor<T = {}> = new (...args: any[]) => T;
interface UserLike {
    id?: number;
    phone?: string;
    email?: string;
}
/**
 * Apply the Pulse mixin to a User model class
 * This adds sendPushNotification, sendSms, and sendEmail methods
 */
export declare function applyPulseMixin<TBase extends Constructor<Model<any> & UserLike>>(Base: TBase): {
    new (...args: any[]): {
        /**
         * Send push notification to all user's devices
         */
        sendPushNotification(params: {
            title?: string;
            body: string;
            data?: Record<string, any>;
        }, providerName?: string): Promise<PushResult[]>;
        /**
         * Send SMS to user's phone number
         */
        sendSms(params: {
            message: string;
        }, providerName?: string): Promise<PulseResult>;
        /**
         * Send transactional email to user
         */
        sendEmail(params: {
            subject: string;
            content: {
                title?: string;
                greeting?: string;
                body: string;
                footer?: string;
            };
        }, providerName?: string): Promise<PulseResult>;
        id?: number | any;
        createdAt?: Date | any;
        updatedAt?: Date | any;
        deletedAt?: Date | any;
        version?: number | any;
        $add<R extends Model>(propertyKey: string, instances: R | R[] | string[] | string | number[] | number, options?: import("sequelize-typescript").AssociationActionOptions): Promise<unknown>;
        $set<R extends Model>(propertyKey: keyof /*elided*/ any, instances: string | number | string[] | number[] | R | R[], options?: import("sequelize-typescript").AssociationActionOptions): Promise<unknown>;
        $get<K extends keyof /*elided*/ any>(propertyKey: K, options?: import("sequelize-typescript").AssociationGetOptions): Promise<import("sequelize-typescript").$GetType</*elided*/ any[K]>>;
        $count(propertyKey: string, options?: import("sequelize-typescript").AssociationCountOptions): Promise<number>;
        $create<R extends Model>(propertyKey: string, values: any, options?: import("sequelize-typescript/dist/model/model/association/association-create-options.js").AssociationCreateOptions): Promise<R>;
        $has<R extends Model>(propertyKey: string, instances: R | R[] | string[] | string | number[] | number, options?: import("sequelize-typescript").AssociationGetOptions): Promise<boolean>;
        $remove<R extends Model>(propertyKey: string, instances: R | R[] | string[] | string | number[] | number, options?: any): Promise<any>;
        reload(options?: import("sequelize").FindOptions): Promise</*elided*/ any>;
        _attributes: any;
        dataValues: any;
        _creationAttributes: any;
        isNewRecord: boolean;
        sequelize: import("sequelize").Sequelize;
        where(): object;
        getDataValue<K extends string | number | symbol>(key: K): any;
        setDataValue<K extends string | number | symbol>(key: K, value: any): void;
        get(options?: {
            plain?: boolean;
            clone?: boolean;
        }): any;
        get<K extends keyof /*elided*/ any>(key: K, options?: {
            plain?: boolean;
            clone?: boolean;
        }): /*elided*/ any[K];
        get(key: string, options?: {
            plain?: boolean;
            clone?: boolean;
        }): unknown;
        set<K extends string | number | symbol>(key: K, value: any, options?: import("sequelize").SetOptions): /*elided*/ any;
        set(keys: Partial<any>, options?: import("sequelize").SetOptions): /*elided*/ any;
        setAttributes<K extends string | number | symbol>(key: K, value: any, options?: import("sequelize").SetOptions): /*elided*/ any;
        setAttributes(keys: Partial<any>, options?: import("sequelize").SetOptions): /*elided*/ any;
        changed<K extends keyof /*elided*/ any>(key: K): boolean;
        changed<K extends keyof /*elided*/ any>(key: K, dirty: boolean): void;
        changed(): false | string[];
        previous(): Partial<any>;
        previous<K extends string | number | symbol>(key: K): any;
        save(options?: import("sequelize").SaveOptions<any>): Promise</*elided*/ any>;
        validate(options?: import("sequelize/lib/instance-validator").ValidationOptions): Promise<void>;
        update<K extends string | number | symbol>(key: K, value: any, options?: import("sequelize").InstanceUpdateOptions<any>): Promise</*elided*/ any>;
        update(keys: {
            [x: string]: any;
        }, options?: import("sequelize").InstanceUpdateOptions<any>): Promise</*elided*/ any>;
        destroy(options?: import("sequelize").InstanceDestroyOptions): Promise<void>;
        restore(options?: import("sequelize").InstanceRestoreOptions): Promise<void>;
        increment<K extends string | number | symbol>(fields: Partial<any> | K | readonly K[], options?: import("sequelize").IncrementDecrementOptionsWithBy<any>): Promise</*elided*/ any>;
        decrement<K extends string | number | symbol>(fields: Partial<any> | K | readonly K[], options?: import("sequelize").IncrementDecrementOptionsWithBy<any>): Promise</*elided*/ any>;
        equals(other: /*elided*/ any): boolean;
        equalsOneOf(others: readonly /*elided*/ any[]): boolean;
        toJSON<T extends any>(): T;
        toJSON(): object;
        isSoftDeleted(): boolean;
        _model: import("sequelize").Model<any, any>;
        addHook<K extends keyof import("sequelize/lib/hooks").SequelizeHooks<M, TModelAttributes, TCreationAttributes>>(hookType: K, name: string, fn: import("sequelize/lib/hooks").SequelizeHooks<import("sequelize").Model<any, any>, any, any>[K]): /*elided*/ any;
        addHook<K extends keyof import("sequelize/lib/hooks").SequelizeHooks<M, TModelAttributes, TCreationAttributes>>(hookType: K, fn: import("sequelize/lib/hooks").SequelizeHooks<import("sequelize").Model<any, any>, any, any>[K]): /*elided*/ any;
        removeHook<K extends keyof import("sequelize/lib/hooks").SequelizeHooks<M, TModelAttributes, TCreationAttributes>>(hookType: K, name: string): /*elided*/ any;
        hasHook<K extends keyof import("sequelize/lib/hooks").SequelizeHooks<M, TModelAttributes, TCreationAttributes>>(hookType: K): boolean;
        hasHooks<K extends keyof import("sequelize/lib/hooks").SequelizeHooks<M, TModelAttributes, TCreationAttributes>>(hookType: K): boolean;
        phone?: string;
        email?: string;
    };
} & TBase;
export {};
