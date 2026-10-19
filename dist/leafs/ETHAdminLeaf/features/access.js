var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from 'etherial';
import { Op } from 'sequelize';
import { AdminRole } from '../models/AdminRole.js';
/** The collection the leaf registers to manage roles, unless the project has its own. */
export const ADMIN_ROLES_COLLECTION = 'admin-roles';
export function rolesOptions(value) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    if (!value) {
        return null;
    }
    const config = value === true ? {} : value;
    const roleColumn = (_a = config.roleColumn) !== null && _a !== void 0 ? _a : 'role';
    const roleIdColumn = (_b = config.roleIdColumn) !== null && _b !== void 0 ? _b : 'admin_role_id';
    const usersCollection = (_c = config.usersCollection) !== null && _c !== void 0 ? _c : 'users';
    // A configured list adds to the defaults: forgetting the role columns in
    // it must not let a staff member promote themselves.
    const protectedColumns = { [usersCollection]: [roleColumn, roleIdColumn] };
    for (const [collection, columns] of Object.entries((_d = config.protectedColumns) !== null && _d !== void 0 ? _d : {})) {
        protectedColumns[collection] = [...new Set([...((_e = protectedColumns[collection]) !== null && _e !== void 0 ? _e : []), ...columns])];
    }
    return {
        superAdminRoles: (_f = config.superAdminRoles) !== null && _f !== void 0 ? _f : [1],
        staffRoles: (_g = config.staffRoles) !== null && _g !== void 0 ? _g : [2],
        roleColumn,
        roleIdColumn,
        usersModel: (_h = config.usersModel) !== null && _h !== void 0 ? _h : 'User',
        usersCollection,
        protectedColumns,
        superAdminOnlyCollections: [...new Set([ADMIN_ROLES_COLLECTION, ...((_j = config.superAdminOnlyCollections) !== null && _j !== void 0 ? _j : [])])],
    };
}
let roles = null;
/** Set by the leaf from `features.roles`; null while the feature is off. */
export function configureRoles(config) {
    roles = config;
}
export function rolesConfig() {
    return roles;
}
const getAdminLeaf = () => etherial.eth_admin_leaf;
// ============================================
// Roles
// ============================================
/** Null when the user has no back-office access, or `features.roles` is off. */
export function resolveAccess(user) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!user || !roles) {
            return null;
        }
        const role = user[roles.roleColumn];
        if (roles.superAdminRoles.includes(role)) {
            return { isSuperAdmin: true, permissions: {} };
        }
        const roleId = user[roles.roleIdColumn];
        if (!roles.staffRoles.includes(role) || !roleId) {
            return null;
        }
        const adminRole = yield AdminRole.cached(Number(roleId));
        if (!adminRole) {
            return null;
        }
        return { isSuperAdmin: false, permissions: adminRole.permissions || {} };
    });
}
/**
 * The permission an access check needs. The leaf names CRUD steps (list,
 * show, create, update, delete) and, for buttons, the action itself.
 */
export function permissionFor(method) {
    switch (method) {
        case 'list':
        case 'show':
            return 'view';
        case 'create':
            return 'create';
        case 'update':
            return 'update';
        case 'delete':
            return 'delete';
        default:
            return 'actions';
    }
}
function superAdminOnly(collection) {
    var _a;
    return ((_a = roles === null || roles === void 0 ? void 0 : roles.superAdminOnlyCollections) !== null && _a !== void 0 ? _a : [ADMIN_ROLES_COLLECTION]).includes(collection);
}
export function hasCollectionPermission(access, collection, permission) {
    var _a;
    if (!access) {
        return false;
    }
    if (access.isSuperAdmin) {
        return true;
    }
    if (superAdminOnly(collection)) {
        return false;
    }
    const granted = ((_a = access.permissions.collections) === null || _a === void 0 ? void 0 : _a[collection]) || [];
    // Being able to change something means being able to see it.
    if (permission === 'view') {
        return granted.length > 0;
    }
    return granted.includes(permission);
}
/**
 * Collections a role may only look up: the targets of the relation fields of
 * the collections it can view (the customer on an order, the category of an
 * item). Pickers and filters list them; the role does not get them in its
 * menu, nor can it open, export or change them.
 */
export function lookupCollections(access) {
    var _a, _b, _c;
    const out = new Set();
    if (!access || access.isSuperAdmin) {
        return out;
    }
    for (const collection of ((_a = getAdminLeaf()) === null || _a === void 0 ? void 0 : _a.collections) || []) {
        if (!hasCollectionPermission(access, collection.name, 'view')) {
            continue;
        }
        for (const field of collection.fields || []) {
            const target = ((_b = field.relation) === null || _b === void 0 ? void 0 : _b.collection) || ((_c = field.belongsToMany) === null || _c === void 0 ? void 0 : _c.collection);
            if (target && !superAdminOnly(target)) {
                out.add(target);
            }
        }
    }
    return out;
}
/** The roles access checker: `method` is a CRUD step or an action name. */
export function canAccessCollection(access, collection, method) {
    if (hasCollectionPermission(access, collection, permissionFor(method))) {
        return true;
    }
    return method === 'list' && lookupCollections(access).has(collection);
}
export function canAccessPage(access, page) {
    if (!access) {
        return false;
    }
    return access.isSuperAdmin || (access.permissions.pages || []).includes(page);
}
export function canSeeDashboard(access) {
    return !!access && (access.isSuperAdmin || access.permissions.dashboard === true);
}
export function canSeeMonitoring(access) {
    return !!access && (access.isSuperAdmin || access.permissions.monitoring === true);
}
/**
 * Whether the user may do everything. Without roles, anyone the project's
 * admin checker lets in.
 */
export function isSuperAdmin(user) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!user) {
            return false;
        }
        if (roles) {
            return ((_a = (yield resolveAccess(user))) === null || _a === void 0 ? void 0 : _a.isSuperAdmin) === true;
        }
        return !!(yield ((_b = getAdminLeaf()) === null || _b === void 0 ? void 0 : _b.canAccessAdmin(user)));
    });
}
/**
 * Joins users and roles both ways (`user.admin_role`, `role.users`). The
 * leaf cannot decorate the project's user model, so the link is made once
 * both models are known, before the project syncs.
 */
export function linkRolesToUsers() {
    var _a, _b, _c, _d, _e;
    const User = roles ? (_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) === null || _c === void 0 ? void 0 : _c[roles.usersModel] : null;
    if (!roles || !User) {
        return false;
    }
    if (!((_d = User.associations) === null || _d === void 0 ? void 0 : _d.admin_role)) {
        User.belongsTo(AdminRole, { foreignKey: roles.roleIdColumn, as: 'admin_role' });
    }
    if (!((_e = AdminRole.associations) === null || _e === void 0 ? void 0 : _e.users)) {
        AdminRole.hasMany(User, { foreignKey: roles.roleIdColumn, as: 'users' });
    }
    return true;
}
/**
 * The `admin-roles` collection, for a project that does not register its own.
 * `permissions` is a matrix the back-office builds from the schema, so new
 * collections show up in it without touching this.
 */
export function adminRolesCollection() {
    var _a, _b, _c, _d, _e, _f;
    const User = roles ? (_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) === null || _c === void 0 ? void 0 : _c[roles.usersModel] : null;
    const userColumns = Object.keys((User === null || User === void 0 ? void 0 : User.rawAttributes) || {});
    const staffFields = ['id', 'email', 'firstname', 'lastname', 'first_name', 'last_name', (_d = roles === null || roles === void 0 ? void 0 : roles.roleColumn) !== null && _d !== void 0 ? _d : 'role'].filter((name) => userColumns.includes(name));
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
                            name: (_e = roles === null || roles === void 0 ? void 0 : roles.usersCollection) !== null && _e !== void 0 ? _e : 'users',
                            title: 'Staff with this role',
                            model: User,
                            foreignKey: (_f = roles === null || roles === void 0 ? void 0 : roles.roleIdColumn) !== null && _f !== void 0 ? _f : 'admin_role_id',
                            fields: staffFields,
                        },
                    ]
                    : undefined,
            },
            create: { fields: ['name', 'description', 'permissions'] },
            edit: { fields: ['name', 'description', 'permissions'] },
        },
    };
}
/** The CRUD step whose check stands for a permission, when no role says it directly. */
const METHOD_FOR = {
    view: 'show',
    create: 'create',
    update: 'update',
    delete: 'delete',
    actions: 'actions',
};
/** Without roles, how many accounts `listAdminUsers` asks the project's checkers about. */
const ADMIN_SCAN_LIMIT = 5000;
const ADMIN_SCAN_BATCH = 500;
function usersModel() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const name = (_a = roles === null || roles === void 0 ? void 0 : roles.usersModel) !== null && _a !== void 0 ? _a : 'User';
    const fromCollection = (_e = (_c = (_b = getAdminLeaf()) === null || _b === void 0 ? void 0 : _b.getCollection) === null || _c === void 0 ? void 0 : _c.call(_b, (_d = roles === null || roles === void 0 ? void 0 : roles.usersCollection) !== null && _d !== void 0 ? _d : 'users')) === null || _e === void 0 ? void 0 : _e.model;
    return (_k = (_j = (_h = (_g = (_f = etherial.database) === null || _f === void 0 ? void 0 : _f.sequelize) === null || _g === void 0 ? void 0 : _g.models) === null || _h === void 0 ? void 0 : _h[name]) !== null && _j !== void 0 ? _j : fromCollection) !== null && _k !== void 0 ? _k : null;
}
/**
 * The accounts that can open the back-office, optionally only those holding
 * `permission` (default `view`) on `collection`. Credentials are never read.
 *
 * With roles, a query on the role columns. Without, the project's checkers
 * are the only judge: the first 5000 accounts are asked, by id.
 */
export function listAdminUsers() {
    return __awaiter(this, arguments, void 0, function* (filter = {}) {
        var _a;
        const User = usersModel();
        if (!User) {
            return [];
        }
        const attributes = Object.keys(User.rawAttributes || {}).filter((name) => !isSecretColumn(name));
        const permission = (_a = filter.permission) !== null && _a !== void 0 ? _a : 'view';
        if (roles) {
            const candidates = yield User.findAll({
                attributes,
                where: {
                    [Op.or]: [
                        { [roles.roleColumn]: { [Op.in]: roles.superAdminRoles } },
                        { [roles.roleColumn]: { [Op.in]: roles.staffRoles }, [roles.roleIdColumn]: { [Op.ne]: null } },
                    ],
                },
            });
            const out = [];
            for (const user of candidates) {
                const access = yield resolveAccess(user);
                if (!access) {
                    continue;
                }
                if (filter.collection && !hasCollectionPermission(access, filter.collection, permission)) {
                    continue;
                }
                out.push(user);
            }
            return out;
        }
        const adminLeaf = getAdminLeaf();
        if (!(adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.adminAccessChecker)) {
            return [];
        }
        const out = [];
        for (let offset = 0; offset < ADMIN_SCAN_LIMIT; offset += ADMIN_SCAN_BATCH) {
            const batch = yield User.findAll({ attributes, order: [['id', 'ASC']], limit: ADMIN_SCAN_BATCH, offset });
            for (const user of batch) {
                if (!(yield adminLeaf.canAccessAdmin(user))) {
                    continue;
                }
                if (filter.collection && !(yield adminLeaf.checkAccess(user, filter.collection, METHOD_FOR[permission]))) {
                    continue;
                }
                out.push(user);
            }
            if (batch.length < ADMIN_SCAN_BATCH) {
                break;
            }
        }
        return out;
    });
}
/**
 * The roles gate, mounted in front of every route under the admin prefix:
 * authenticate, then refuse anyone without back-office access. It covers the
 * project's own `/admin` routes too, which the leaf's checks never see.
 */
export function rolesGateMiddleware(prefix) {
    const isPublic = (path) => path === `${prefix}/login` ||
        path.startsWith(`${prefix}/login/`) ||
        path === `${prefix}/public-settings` ||
        path === `${prefix}/settings/public`;
    return (req, res, next) => {
        if (req.path !== prefix && !req.path.startsWith(`${prefix}/`)) {
            return next();
        }
        if (req.method === 'OPTIONS' || isPublic(req.path)) {
            return next();
        }
        const auth = etherial.http_auth;
        if (!auth) {
            return next();
        }
        // authMiddleware answers 401 itself and only calls back once the user is known.
        Promise.resolve(auth.authMiddleware(req, res, (err) => __awaiter(this, void 0, void 0, function* () {
            if (err) {
                return next(err);
            }
            try {
                const access = yield resolveAccess(req.user);
                req.adminAccess = access;
                if (!access) {
                    return res.status(403).json({ status: 403, errors: ['forbidden'] });
                }
                return next();
            }
            catch (error) {
                return next(error);
            }
        }))).catch(next);
    };
}
// ============================================
// Writable fields
// ============================================
const TIMESTAMP_COLUMNS = new Set(['created_at', 'updated_at', 'deleted_at', 'createdAt', 'updatedAt', 'deletedAt']);
/**
 * The columns a write from the back-office may set on a collection: its
 * declared, editable fields, the columns a map picker writes next to itself,
 * and `extraWritable`. A super admin also gets the protected columns.
 *
 * The routes hand what is left to `record.update()`: without this cut, a role
 * allowed to edit orders could set any column of the table, its own
 * `users.role` included.
 */
export function writableFields(collection, user) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const out = new Set();
        const fields = collection.fields || [];
        // A collection that declares nothing takes its columns from the model, as
        // the forms do; the keys and timestamps are never typed in.
        if (fields.length === 0) {
            for (const [name, attribute] of Object.entries(((_a = collection.model) === null || _a === void 0 ? void 0 : _a.rawAttributes) || {})) {
                if ((attribute === null || attribute === void 0 ? void 0 : attribute.primaryKey) || TIMESTAMP_COLUMNS.has(name)) {
                    continue;
                }
                out.add(name);
            }
        }
        for (const field of fields) {
            if (field.readonly) {
                continue;
            }
            out.add(field.name);
            // The pin's coordinates are readonly fields the widget fills in.
            if (field.map) {
                out.add(field.map.latField);
                out.add(field.map.lngField);
                if (field.map.addressField) {
                    out.add(field.map.addressField);
                }
            }
        }
        for (const name of collection.extraWritable || []) {
            out.add(name);
        }
        for (const name of yield lockedColumns(collection, user)) {
            out.delete(name);
        }
        return out;
    });
}
/**
 * The protected columns of a collection this user may not set (none for a
 * super admin): a staff allowed to edit users must not change anyone's role,
 * his own included.
 */
export function lockedColumns(collection, user) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const protectedColumns = (_a = roles === null || roles === void 0 ? void 0 : roles.protectedColumns[collection.name]) !== null && _a !== void 0 ? _a : [];
        if (protectedColumns.length === 0 || (yield isSuperAdmin(user))) {
            return [];
        }
        return protectedColumns;
    });
}
/** `data` without the keys a write may not set. */
export function keepWritable(data, writable) {
    const out = {};
    for (const [key, value] of Object.entries(data || {})) {
        if (writable.has(key)) {
            out[key] = value;
        }
    }
    return out;
}
// ============================================
// Secrets
// ============================================
/** Credentials never leave the API, whoever asks and whatever the collection. */
const BASE_SECRET_COLUMNS = ['password', 'password_reset_token', 'email_confirmation_token', 'phone_verification_token'];
let secretColumns = new Set(BASE_SECRET_COLUMNS);
/** Adds the project's own (`secretColumns` in the leaf config). */
export function configureSecretColumns(extra) {
    secretColumns = new Set([...BASE_SECRET_COLUMNS, ...(extra !== null && extra !== void 0 ? extra : [])]);
}
export function isSecretColumn(name) {
    return secretColumns.has(name);
}
/**
 * A plain copy of `body` without any secret key, at any depth. Model
 * instances go through their `toJSON` on the way.
 */
export function withoutSecrets(body) {
    if (body === undefined || body === null) {
        return body;
    }
    return JSON.parse(JSON.stringify(body, (key, value) => (key && secretColumns.has(key) ? undefined : value)));
}
/**
 * Strips secrets from every response under the given paths: lists, records,
 * sub-lists (a role's "staff with this role" came back with the password
 * hashes), search, the results of create / update / duplicate / restore.
 * Action results are left alone: an action may hand back on purpose what it
 * just generated.
 */
export function secretsMiddleware() {
    return (req, res, next) => {
        if (req.method === 'POST' && /\/actions\/?$/.test(req.path)) {
            return next();
        }
        const send = res.json.bind(res);
        res.json = (body) => {
            try {
                return send(withoutSecrets(body));
            }
            catch (_a) {
                return send(body);
            }
        };
        return next();
    };
}
