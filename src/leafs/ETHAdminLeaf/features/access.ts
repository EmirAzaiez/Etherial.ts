import type { Request, Response, NextFunction } from 'express'
import etherial from 'etherial'
import { Op } from 'sequelize'
import { AdminRole } from '../models/AdminRole.js'
import type { CollectionPermission, RolePermissions } from '../models/AdminRole.js'
import type { CollectionConfig } from './CollectionConfig.js'

export type { CollectionPermission, RolePermissions } from '../models/AdminRole.js'

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
    superAdminRoles?: Array<number | string>
    /** Values of the role column whose access comes from their admin role. Default `[2]`. */
    staffRoles?: Array<number | string>
    /** The users column holding the role. Default `role`. */
    roleColumn?: string
    /** The users column pointing at `admin_roles.id`. Default `admin_role_id`. */
    roleIdColumn?: string
    /** The project's user model name, as Sequelize knows it. Default `User`. */
    usersModel?: string
    /** The admin collection over that model. Default `users`. */
    usersCollection?: string
    /**
     * Columns only a super admin may write, per collection: they decide who
     * gets access to what. The users' role columns are always in.
     */
    protectedColumns?: Record<string, string[]>
    /** Collections no role can be granted. `admin-roles` is always in. */
    superAdminOnlyCollections?: string[]
}

export type ResolvedRolesConfig = Required<RolesConfig>

/** The collection the leaf registers to manage roles, unless the project has its own. */
export const ADMIN_ROLES_COLLECTION = 'admin-roles'

/** The access a user has, as the checks read it. */
export interface AdminAccess {
    isSuperAdmin: boolean
    permissions: RolePermissions
}

export function rolesOptions(value: boolean | RolesConfig | undefined): ResolvedRolesConfig | null {
    if (!value) {
        return null
    }

    const config: RolesConfig = value === true ? {} : value
    const roleColumn = config.roleColumn ?? 'role'
    const roleIdColumn = config.roleIdColumn ?? 'admin_role_id'
    const usersCollection = config.usersCollection ?? 'users'

    // A configured list adds to the defaults: forgetting the role columns in
    // it must not let a staff member promote themselves.
    const protectedColumns: Record<string, string[]> = { [usersCollection]: [roleColumn, roleIdColumn] }
    for (const [collection, columns] of Object.entries(config.protectedColumns ?? {})) {
        protectedColumns[collection] = [...new Set([...(protectedColumns[collection] ?? []), ...columns])]
    }

    return {
        superAdminRoles: config.superAdminRoles ?? [1],
        staffRoles: config.staffRoles ?? [2],
        roleColumn,
        roleIdColumn,
        usersModel: config.usersModel ?? 'User',
        usersCollection,
        protectedColumns,
        superAdminOnlyCollections: [...new Set([ADMIN_ROLES_COLLECTION, ...(config.superAdminOnlyCollections ?? [])])],
    }
}

let roles: ResolvedRolesConfig | null = null

/** Set by the leaf from `features.roles`; null while the feature is off. */
export function configureRoles(config: ResolvedRolesConfig | null): void {
    roles = config
}

export function rolesConfig(): ResolvedRolesConfig | null {
    return roles
}

const getAdminLeaf = () => (etherial as any).eth_admin_leaf

// ============================================
// Roles
// ============================================

/** Null when the user has no back-office access, or `features.roles` is off. */
export async function resolveAccess(user: any): Promise<AdminAccess | null> {
    if (!user || !roles) {
        return null
    }

    const role = user[roles.roleColumn]
    if (roles.superAdminRoles.includes(role)) {
        return { isSuperAdmin: true, permissions: {} }
    }

    const roleId = user[roles.roleIdColumn]
    if (!roles.staffRoles.includes(role) || !roleId) {
        return null
    }

    const adminRole = await AdminRole.cached(Number(roleId))
    if (!adminRole) {
        return null
    }

    return { isSuperAdmin: false, permissions: adminRole.permissions || {} }
}

/**
 * The permission an access check needs. The leaf names CRUD steps (list,
 * show, create, update, delete) and, for buttons, the action itself.
 */
export function permissionFor(method: string): CollectionPermission {
    switch (method) {
        case 'list':
        case 'show':
            return 'view'
        case 'create':
            return 'create'
        case 'update':
            return 'update'
        case 'delete':
            return 'delete'
        default:
            return 'actions'
    }
}

function superAdminOnly(collection: string): boolean {
    return (roles?.superAdminOnlyCollections ?? [ADMIN_ROLES_COLLECTION]).includes(collection)
}

export function hasCollectionPermission(access: AdminAccess | null, collection: string, permission: CollectionPermission): boolean {
    if (!access) {
        return false
    }
    if (access.isSuperAdmin) {
        return true
    }
    if (superAdminOnly(collection)) {
        return false
    }

    const granted = access.permissions.collections?.[collection] || []
    // Being able to change something means being able to see it.
    if (permission === 'view') {
        return granted.length > 0
    }
    return granted.includes(permission)
}

/**
 * Collections a role may only look up: the targets of the relation fields of
 * the collections it can view (the customer on an order, the category of an
 * item). Pickers and filters list them; the role does not get them in its
 * menu, nor can it open, export or change them.
 */
export function lookupCollections(access: AdminAccess | null): Set<string> {
    const out = new Set<string>()
    if (!access || access.isSuperAdmin) {
        return out
    }

    for (const collection of getAdminLeaf()?.collections || []) {
        if (!hasCollectionPermission(access, collection.name, 'view')) {
            continue
        }
        for (const field of collection.fields || []) {
            const target = field.relation?.collection || field.belongsToMany?.collection
            if (target && !superAdminOnly(target)) {
                out.add(target)
            }
        }
    }
    return out
}

/** The roles access checker: `method` is a CRUD step or an action name. */
export function canAccessCollection(access: AdminAccess | null, collection: string, method: string): boolean {
    if (hasCollectionPermission(access, collection, permissionFor(method))) {
        return true
    }
    return method === 'list' && lookupCollections(access).has(collection)
}

export function canAccessPage(access: AdminAccess | null, page: string): boolean {
    if (!access) {
        return false
    }
    return access.isSuperAdmin || (access.permissions.pages || []).includes(page)
}

export function canSeeDashboard(access: AdminAccess | null): boolean {
    return !!access && (access.isSuperAdmin || access.permissions.dashboard === true)
}

export function canSeeMonitoring(access: AdminAccess | null): boolean {
    return !!access && (access.isSuperAdmin || access.permissions.monitoring === true)
}

/**
 * Whether the user may do everything. Without roles, anyone the project's
 * admin checker lets in.
 */
export async function isSuperAdmin(user: any): Promise<boolean> {
    if (!user) {
        return false
    }
    if (roles) {
        return (await resolveAccess(user))?.isSuperAdmin === true
    }
    return !!(await getAdminLeaf()?.canAccessAdmin(user))
}

/**
 * Joins users and roles both ways (`user.admin_role`, `role.users`). The
 * leaf cannot decorate the project's user model, so the link is made once
 * both models are known, before the project syncs.
 */
export function linkRolesToUsers(): boolean {
    const User = roles ? (etherial as any).database?.sequelize?.models?.[roles.usersModel] : null
    if (!roles || !User) {
        return false
    }

    if (!User.associations?.admin_role) {
        User.belongsTo(AdminRole, { foreignKey: roles.roleIdColumn, as: 'admin_role' })
    }
    if (!(AdminRole as any).associations?.users) {
        AdminRole.hasMany(User, { foreignKey: roles.roleIdColumn, as: 'users' })
    }
    return true
}

/**
 * The `admin-roles` collection, for a project that does not register its own.
 * `permissions` is a matrix the back-office builds from the schema, so new
 * collections show up in it without touching this.
 */
export function adminRolesCollection(): CollectionConfig {
    const User = roles ? (etherial as any).database?.sequelize?.models?.[roles.usersModel] : null
    const userColumns = Object.keys(User?.rawAttributes || {})
    const staffFields = ['id', 'email', 'firstname', 'lastname', 'first_name', 'last_name', roles?.roleColumn ?? 'role'].filter((name) =>
        userColumns.includes(name)
    )

    return {
        name: ADMIN_ROLES_COLLECTION,
        model: AdminRole,
        crud: ['list', 'show', 'create', 'update', 'delete'],
        meta: {
            label: 'Admin Role',
            labelPlural: 'Admin Roles',
            icon: 'shield',
            description: 'What each staff role can see and do in the back-office',
            group: 'System',
            order: 1,
        },
        fields: [
            { name: 'id', type: 'integer', label: 'ID', readonly: true, sortable: true },
            { name: 'name', type: 'string', label: 'Name', required: true, searchable: true, sortable: true, col: 6 },
            { name: 'description', type: 'text', label: 'Description', col: 12 },
            {
                name: 'permissions',
                type: 'permissions-matrix',
                label: 'Permissions',
                helpText: 'Tick a module to give the whole of it, or pick collection by collection.',
            },
            { name: 'created_at', type: 'datetime', label: 'Created', readonly: true, sortable: true },
            { name: 'updated_at', type: 'datetime', label: 'Updated', readonly: true, sortable: true },
        ],
        views: {
            list: {
                fields: ['id', 'name', 'description', 'updated_at'],
                sort: { field: 'name', direction: 'asc' },
                search: ['name'],
            },
            show: {
                layout: 'sections',
                sections: [
                    { title: 'Role', fields: ['name', 'description'] },
                    { title: 'Permissions', fields: ['permissions'] },
                ],
                collections: User
                    ? [
                          {
                              name: roles?.usersCollection ?? 'users',
                              title: 'Staff with this role',
                              model: User,
                              foreignKey: roles?.roleIdColumn ?? 'admin_role_id',
                              fields: staffFields,
                          },
                      ]
                    : undefined,
            },
            create: { fields: ['name', 'description', 'permissions'] },
            edit: { fields: ['name', 'description', 'permissions'] },
        },
    }
}

/** The CRUD step whose check stands for a permission, when no role says it directly. */
const METHOD_FOR: Record<CollectionPermission, string> = {
    view: 'show',
    create: 'create',
    update: 'update',
    delete: 'delete',
    actions: 'actions',
}

/** Without roles, how many accounts `listAdminUsers` asks the project's checkers about. */
const ADMIN_SCAN_LIMIT = 5000
const ADMIN_SCAN_BATCH = 500

function usersModel(): any {
    const name = roles?.usersModel ?? 'User'
    const fromCollection = getAdminLeaf()?.getCollection?.(roles?.usersCollection ?? 'users')?.model
    return (etherial as any).database?.sequelize?.models?.[name] ?? fromCollection ?? null
}

/**
 * The accounts that can open the back-office, optionally only those holding
 * `permission` (default `view`) on `collection`. Credentials are never read.
 *
 * With roles, a query on the role columns. Without, the project's checkers
 * are the only judge: the first 5000 accounts are asked, by id.
 */
export async function listAdminUsers(filter: { collection?: string; permission?: CollectionPermission } = {}): Promise<any[]> {
    const User = usersModel()
    if (!User) {
        return []
    }

    const attributes = Object.keys(User.rawAttributes || {}).filter((name) => !isSecretColumn(name))
    const permission = filter.permission ?? 'view'

    if (roles) {
        const candidates = await User.findAll({
            attributes,
            where: {
                [Op.or]: [
                    { [roles.roleColumn]: { [Op.in]: roles.superAdminRoles } },
                    { [roles.roleColumn]: { [Op.in]: roles.staffRoles }, [roles.roleIdColumn]: { [Op.ne]: null } },
                ],
            },
        })

        const out: any[] = []
        for (const user of candidates) {
            const access = await resolveAccess(user)
            if (!access) {
                continue
            }
            if (filter.collection && !hasCollectionPermission(access, filter.collection, permission)) {
                continue
            }
            out.push(user)
        }
        return out
    }

    const adminLeaf = getAdminLeaf()
    if (!adminLeaf?.adminAccessChecker) {
        return []
    }

    const out: any[] = []
    for (let offset = 0; offset < ADMIN_SCAN_LIMIT; offset += ADMIN_SCAN_BATCH) {
        const batch = await User.findAll({ attributes, order: [['id', 'ASC']], limit: ADMIN_SCAN_BATCH, offset })
        for (const user of batch) {
            if (!(await adminLeaf.canAccessAdmin(user))) {
                continue
            }
            if (filter.collection && !(await adminLeaf.checkAccess(user, filter.collection, METHOD_FOR[permission]))) {
                continue
            }
            out.push(user)
        }
        if (batch.length < ADMIN_SCAN_BATCH) {
            break
        }
    }
    return out
}

/**
 * The roles gate, mounted in front of every route under the admin prefix:
 * authenticate, then refuse anyone without back-office access. It covers the
 * project's own `/admin` routes too, which the leaf's checks never see.
 */
export function rolesGateMiddleware(prefix: string) {
    const isPublic = (path: string) =>
        path === `${prefix}/login` ||
        path.startsWith(`${prefix}/login/`) ||
        path === `${prefix}/public-settings` ||
        path === `${prefix}/settings/public`

    return (req: Request, res: Response, next: NextFunction) => {
        if (req.path !== prefix && !req.path.startsWith(`${prefix}/`)) {
            return next()
        }
        if (req.method === 'OPTIONS' || isPublic(req.path)) {
            return next()
        }

        const auth = (etherial as any).http_auth
        if (!auth) {
            return next()
        }

        // authMiddleware answers 401 itself and only calls back once the user is known.
        Promise.resolve(
            auth.authMiddleware(req, res, async (err?: unknown) => {
                if (err) {
                    return next(err)
                }
                try {
                    const access = await resolveAccess((req as any).user)
                    ;(req as any).adminAccess = access
                    if (!access) {
                        return res.status(403).json({ status: 403, errors: ['forbidden'] })
                    }
                    return next()
                } catch (error) {
                    return next(error)
                }
            })
        ).catch(next)
    }
}

// ============================================
// Writable fields
// ============================================

const TIMESTAMP_COLUMNS = new Set(['created_at', 'updated_at', 'deleted_at', 'createdAt', 'updatedAt', 'deletedAt'])

/**
 * The columns a write from the back-office may set on a collection: its
 * declared, editable fields, the columns a map picker or another widget writes
 * next to itself, and `extraWritable`. A super admin also gets the protected columns.
 *
 * The routes hand what is left to `record.update()`: without this cut, a role
 * allowed to edit orders could set any column of the table, its own
 * `users.role` included.
 */
export async function writableFields(collection: CollectionConfig, user: any): Promise<Set<string>> {
    const out = new Set<string>()
    const fields = collection.fields || []

    // A collection that declares nothing takes its columns from the model, as
    // the forms do; the keys and timestamps are never typed in.
    if (fields.length === 0) {
        for (const [name, attribute] of Object.entries<any>(collection.model?.rawAttributes || {})) {
            if (attribute?.primaryKey || TIMESTAMP_COLUMNS.has(name)) {
                continue
            }
            out.add(name)
        }
    }

    for (const field of fields) {
        if (field.readonly) {
            continue
        }
        out.add(field.name)
        // The pin's coordinates are readonly fields the widget fills in.
        if (field.map) {
            out.add(field.map.latField)
            out.add(field.map.lngField)
            if (field.map.addressField) {
                out.add(field.map.addressField)
            }
        }
        for (const name of field.companions ?? []) {
            out.add(name)
        }
    }

    for (const name of collection.extraWritable || []) {
        out.add(name)
    }

    for (const name of await lockedColumns(collection, user)) {
        out.delete(name)
    }

    return out
}

/**
 * The protected columns of a collection this user may not set (none for a
 * super admin): a staff allowed to edit users must not change anyone's role,
 * his own included.
 */
export async function lockedColumns(collection: CollectionConfig, user: any): Promise<string[]> {
    const protectedColumns = roles?.protectedColumns[collection.name] ?? []
    if (protectedColumns.length === 0 || (await isSuperAdmin(user))) {
        return []
    }
    return protectedColumns
}

/** `data` without the keys a write may not set. */
export function keepWritable(data: Record<string, any>, writable: Set<string>): Record<string, any> {
    const out: Record<string, any> = {}
    for (const [key, value] of Object.entries(data || {})) {
        if (writable.has(key)) {
            out[key] = value
        }
    }
    return out
}

// ============================================
// Secrets
// ============================================

/** Credentials never leave the API, whoever asks and whatever the collection. */
const BASE_SECRET_COLUMNS = ['password', 'password_reset_token', 'email_confirmation_token', 'phone_verification_token']

let secretColumns = new Set(BASE_SECRET_COLUMNS)

/** Adds the project's own (`secretColumns` in the leaf config). */
export function configureSecretColumns(extra: string[] | undefined): void {
    secretColumns = new Set([...BASE_SECRET_COLUMNS, ...(extra ?? [])])
}

export function isSecretColumn(name: string): boolean {
    return secretColumns.has(name)
}

/**
 * A plain copy of `body` without any secret key, at any depth. Model
 * instances go through their `toJSON` on the way.
 */
export function withoutSecrets<T>(body: T): T {
    if (body === undefined || body === null) {
        return body
    }
    return JSON.parse(JSON.stringify(body, (key, value) => (key && secretColumns.has(key) ? undefined : value)))
}

/**
 * Strips secrets from every response under the given paths: lists, records,
 * sub-lists (a role's "staff with this role" came back with the password
 * hashes), search, the results of create / update / duplicate / restore.
 * Action results are left alone: an action may hand back on purpose what it
 * just generated.
 */
export function secretsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
        if (req.method === 'POST' && /\/actions\/?$/.test(req.path)) {
            return next()
        }

        const send = res.json.bind(res)
        res.json = (body: any) => {
            try {
                return send(withoutSecrets(body))
            } catch {
                return send(body)
            }
        }
        return next()
    }
}
