import type { Request, Response, NextFunction } from 'express';
import { AdminAuditLog } from '../models/AdminAuditLog.js';
import type { CollectionConfig } from './CollectionConfig.js';
export interface AuditActor {
    /** `user` for a person, `salesforce`, `system`, or any name an integration gives itself. */
    type: string;
    id?: number | null;
    /** Shown in the history. Defaults to the type for non-users, the account's email for users. */
    label?: string | null;
}
export interface AuditConfig {
    /** Collections not tracked (by name). The leaf's own journals never are. */
    exclude?: string[];
    /** Columns never recorded, on every model. Timestamps always are left out. */
    ignoreFields?: string[];
    /** Columns never recorded for one collection, e.g. `{ properties: ['sf_synced_at'] }`. */
    ignore?: Record<string, string[]>;
    /** Rows read before a bulk update or delete to keep their previous values. Default 500. */
    bulkLimit?: number;
    /** Drop entries older than this many days, checked daily. Default: keep everything. */
    retentionDays?: number;
    /** Collection a user author links to. Default `users`. */
    usersCollection?: string;
    /** Field of the request's user shown as their name. Default `email`. */
    usersDisplayField?: string;
    /** Sequelize model the author ids belong to, joined in the change list. Default `User`. */
    userModel?: string;
}
export declare const AUDIT_COLLECTION = "admin-audit";
/** Values stored in place of what must not be kept (secrets) or could not be (too long). */
export declare const MASKED: {
    __masked: boolean;
};
export declare function auditOptions(value: boolean | AuditConfig | undefined): AuditConfig | null;
/**
 * Runs `fn` with `actor` as the author of every write it makes, awaited or
 * not. `source` says where the change came through (default: the actor type).
 *
 *     await withActor({ type: 'salesforce', label: 'Salesforce' }, () => syncProperties())
 */
export declare function withActor<T>(actor: AuditActor, fn: () => T, source?: string): T;
/** Runs `fn` with `meta` attached to every change it records. */
export declare function withAuditMeta<T>(meta: Record<string, unknown>, fn: () => T): T;
/** The author of a write made now, and where it came through. */
export declare function currentActor(): {
    actor: AuditActor;
    source: string;
    meta: Record<string, unknown> | null;
};
/**
 * Opens the context each request's writes are attributed in. The user is
 * read when a write happens, not here: authentication runs later, per route.
 */
export declare function auditContextMiddleware(config: AuditConfig, prefix: string): (req: Request, _res: Response, next: NextFunction) => void;
interface ModelAudit {
    model: any;
    collection: string;
    ignored: Set<string>;
    secret: Set<string>;
    primaryKey: string;
}
/**
 * Hooks every model the back-office shows, once each: a model listed in two
 * collections is recorded under the first. Returns the collections tracked.
 */
export declare function installAuditHooks(collections: CollectionConfig[], config: AuditConfig): string[];
/** Removes entries older than `retentionDays`, now and then once a day. */
export declare function scheduleAuditRetention(config: AuditConfig): void;
/** Joins entries to the user model so the change list names the author. */
export declare function linkAuditToUsers(config: AuditConfig): boolean;
/** The model, collection and secrets for a collection's records, when they are tracked. */
export declare function auditOf(collection: CollectionConfig | undefined): ModelAudit | undefined;
/** The read-only collection listing every recorded change. */
export declare function auditCollection(config: AuditConfig, tracked: string[], hasUsers: boolean, linked: boolean): {
    name: string;
    model: typeof AdminAuditLog;
    crud: ("list" | "show")[];
    exportable: boolean;
    meta: {
        label: string;
        labelPlural: string;
        icon: string;
        description: string;
        group: string;
        order: number;
    };
    fields: ({
        name: string;
        type: "integer";
        readonly: boolean;
        sortable: boolean;
        label?: undefined;
        filterable?: undefined;
        options?: undefined;
        searchable?: undefined;
        relation?: undefined;
    } | {
        name: string;
        type: "select";
        label: string;
        filterable: boolean;
        options: {
            value: string;
            label: string;
        }[];
        readonly?: undefined;
        sortable?: undefined;
        searchable?: undefined;
        relation?: undefined;
    } | {
        name: string;
        type: "string";
        label: string;
        searchable: boolean;
        readonly?: undefined;
        sortable?: undefined;
        filterable?: undefined;
        options?: undefined;
        relation?: undefined;
    } | {
        name: string;
        type: "relation";
        label: string;
        filterable: boolean;
        relation: {
            collection: string;
            displayField: string;
        };
        readonly?: undefined;
        sortable?: undefined;
        options?: undefined;
        searchable?: undefined;
    } | {
        name: string;
        type: "integer";
        label: string;
        filterable: boolean;
        readonly?: undefined;
        sortable?: undefined;
        options?: undefined;
        searchable?: undefined;
        relation?: undefined;
    } | {
        name: string;
        type: "json";
        label: string;
        readonly: boolean;
        sortable?: undefined;
        filterable?: undefined;
        options?: undefined;
        searchable?: undefined;
        relation?: undefined;
    } | {
        name: string;
        type: "datetime";
        label: string;
        readonly: boolean;
        sortable: boolean;
        filterable: boolean;
        options?: undefined;
        searchable?: undefined;
        relation?: undefined;
    })[];
    views: {
        list: {
            fields: string[];
            sort: {
                field: string;
                direction: "desc";
            };
            search: string[];
            filters: string[];
            include: {
                association: string;
                attributes: string[];
            }[];
        };
        show: {
            layout: "sections";
            sections: {
                title: string;
                fields: string[];
            }[];
            include: {
                association: string;
                attributes: string[];
            }[];
        };
    };
};
export {};
