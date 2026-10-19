import type { Request, Response, NextFunction } from 'express';
import type { CollectionPermission, RolePermissions } from '../models/AdminRole.js';
import type { CollectionConfig } from './CollectionConfig.js';
export type { CollectionPermission, RolePermissions } from '../models/AdminRole.js';
/**
 * Who may do what in the back-office.
 *
 * The leaf always asks two checkers: `setAdminAccessChecker` (may this user
 * open the back-office at all) and `setAccessChecker` (may they run this CRUD
 * step or action on this collection). A project can write its own. With
 * `features.roles` on, the leaf installs these instead, backed by an
 * `admin_roles` table edited from the back-office:
 *
 *   - users whose role column holds one of `superAdminRoles` see and do
 *     everything, and are the only ones who manage roles;
 *   - users whose role column holds one of `staffRoles` get what their
 *     `admin_role_id` grants, per collection: `view` / `create` / `update` /
 *     `delete` / `actions`, plus pages, the dashboard and live monitoring;
 *   - anyone else has no back-office access.
 *
 * Anything a role does not grant is denied.
 */
export interface RolesConfig {
    /** Values of the role column that open everything. Default `[1]`. */
    superAdminRoles?: Array<number | string>;
    /** Values of the role column whose access comes from their admin role. Default `[2]`. */
    staffRoles?: Array<number | string>;
    /** The users column holding the role. Default `role`. */
    roleColumn?: string;
    /** The users column pointing at `admin_roles.id`. Default `admin_role_id`. */
    roleIdColumn?: string;
    /** The project's user model name, as Sequelize knows it. Default `User`. */
    usersModel?: string;
    /** The admin collection over that model. Default `users`. */
    usersCollection?: string;
    /**
     * Columns only a super admin may write, per collection: they decide who
     * gets access to what. The users' role columns are always in.
     */
    protectedColumns?: Record<string, string[]>;
    /** Collections no role can be granted. `admin-roles` is always in. */
    superAdminOnlyCollections?: string[];
}
export type ResolvedRolesConfig = Required<RolesConfig>;
/** The collection the leaf registers to manage roles, unless the project has its own. */
export declare const ADMIN_ROLES_COLLECTION = "admin-roles";
/** The access a user has, as the checks read it. */
export interface AdminAccess {
    isSuperAdmin: boolean;
    permissions: RolePermissions;
}
export declare function rolesOptions(value: boolean | RolesConfig | undefined): ResolvedRolesConfig | null;
/** Set by the leaf from `features.roles`; null while the feature is off. */
export declare function configureRoles(config: ResolvedRolesConfig | null): void;
export declare function rolesConfig(): ResolvedRolesConfig | null;
/** Null when the user has no back-office access, or `features.roles` is off. */
export declare function resolveAccess(user: any): Promise<AdminAccess | null>;
/**
 * The permission an access check needs. The leaf names CRUD steps (list,
 * show, create, update, delete) and, for buttons, the action itself.
 */
export declare function permissionFor(method: string): CollectionPermission;
export declare function hasCollectionPermission(access: AdminAccess | null, collection: string, permission: CollectionPermission): boolean;
/**
 * Collections a role may only look up: the targets of the relation fields of
 * the collections it can view (the customer on an order, the category of an
 * item). Pickers and filters list them; the role does not get them in its
 * menu, nor can it open, export or change them.
 */
export declare function lookupCollections(access: AdminAccess | null): Set<string>;
/** The roles access checker: `method` is a CRUD step or an action name. */
export declare function canAccessCollection(access: AdminAccess | null, collection: string, method: string): boolean;
export declare function canAccessPage(access: AdminAccess | null, page: string): boolean;
export declare function canSeeDashboard(access: AdminAccess | null): boolean;
export declare function canSeeMonitoring(access: AdminAccess | null): boolean;
/**
 * Whether the user may do everything. Without roles, anyone the project's
 * admin checker lets in.
 */
export declare function isSuperAdmin(user: any): Promise<boolean>;
/**
 * Joins users and roles both ways (`user.admin_role`, `role.users`). The
 * leaf cannot decorate the project's user model, so the link is made once
 * both models are known, before the project syncs.
 */
export declare function linkRolesToUsers(): boolean;
/**
 * The `admin-roles` collection, for a project that does not register its own.
 * `permissions` is a matrix the back-office builds from the schema, so new
 * collections show up in it without touching this.
 */
export declare function adminRolesCollection(): CollectionConfig;
/**
 * The accounts that can open the back-office, optionally only those holding
 * `permission` (default `view`) on `collection`. Credentials are never read.
 *
 * With roles, a query on the role columns. Without, the project's checkers
 * are the only judge: the first 5000 accounts are asked, by id.
 */
export declare function listAdminUsers(filter?: {
    collection?: string;
    permission?: CollectionPermission;
}): Promise<any[]>;
/**
 * The roles gate, mounted in front of every route under the admin prefix:
 * authenticate, then refuse anyone without back-office access. It covers the
 * project's own `/admin` routes too, which the leaf's checks never see.
 */
export declare function rolesGateMiddleware(prefix: string): (req: Request, res: Response, next: NextFunction) => void;
/**
 * The columns a write from the back-office may set on a collection: its
 * declared, editable fields, the columns a map picker or another widget writes
 * next to itself, and `extraWritable`. A super admin also gets the protected columns.
 *
 * The routes hand what is left to `record.update()`: without this cut, a role
 * allowed to edit orders could set any column of the table, its own
 * `users.role` included.
 */
export declare function writableFields(collection: CollectionConfig, user: any): Promise<Set<string>>;
/**
 * The protected columns of a collection this user may not set (none for a
 * super admin): a staff allowed to edit users must not change anyone's role,
 * his own included.
 */
export declare function lockedColumns(collection: CollectionConfig, user: any): Promise<string[]>;
/** `data` without the keys a write may not set. */
export declare function keepWritable(data: Record<string, any>, writable: Set<string>): Record<string, any>;
/** Adds the project's own (`secretColumns` in the leaf config). */
export declare function configureSecretColumns(extra: string[] | undefined): void;
export declare function isSecretColumn(name: string): boolean;
/**
 * A plain copy of `body` without any secret key, at any depth. Model
 * instances go through their `toJSON` on the way.
 */
export declare function withoutSecrets<T>(body: T): T;
/**
 * Strips secrets from every response under the given paths: lists, records,
 * sub-lists (a role's "staff with this role" came back with the password
 * hashes), search, the results of create / update / duplicate / restore.
 * Action results are left alone: an action may hand back on purpose what it
 * just generated.
 */
export declare function secretsMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
