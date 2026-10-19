import {
    Table,
    Column,
    Model,
    AllowNull,
    Default,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    UpdatedAt,
    DataType,
    AfterSave,
    AfterDestroy,
} from 'etherial/components/database/provider'

/** What a role may do on one collection. `view` is implied by every other one. */
export type CollectionPermission = 'view' | 'create' | 'update' | 'delete' | 'actions'

/**
 * The permissions a role grants, as edited by the back-office matrix
 * (`permissions-matrix` field). Anything absent is denied. Collection and page
 * names are the admin ones (`activity-bookings`, `appointments-calendar`, …).
 */
export interface RolePermissions {
    dashboard?: boolean
    monitoring?: boolean
    pages?: string[]
    collections?: Record<string, CollectionPermission[]>
}

/** Access checks read a role on every request: a short cache spares the query. */
const ROLE_CACHE_TTL_MS = 30_000
const roleCache = new Map<number, { role: AdminRole | null; at: number }>()

/**
 * A back-office role for staff accounts (`features.roles`), configured from
 * the back-office itself — "Bookings team", "Lifestyle", … Super admins bypass
 * roles entirely and are the only ones who can manage them.
 *
 * The leaf owns the table, so a project that turns roles on gets it on its
 * next sync. Keep `name` unique with an index the project creates after its
 * sync (`CREATE UNIQUE INDEX IF NOT EXISTS admin_roles_name_unique ON
 * admin_roles (name)`), not `@Unique`: the alter-sync re-adds that constraint
 * on every start. The link
 * to the users (`users.admin_role_id`) is wired by the leaf once the project's
 * user model is known.
 */
@Table({
    timestamps: true,
    tableName: 'admin_roles',
    freezeTableName: true,
})
export class AdminRole extends Model<AdminRole> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare id: number

    @AllowNull(false)
    @Column(DataType.STRING)
    declare name: string

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare description: string | null

    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare permissions: RolePermissions

    @CreatedAt
    declare created_at: Date

    @UpdatedAt
    declare updated_at: Date

    /** A role edited in the back-office applies within the request that follows. */
    @AfterSave
    @AfterDestroy
    static clearAccessCache(): void {
        roleCache.clear()
    }

    /** The role as the access checks read it, at most 30 seconds old. */
    static async cached(id: number): Promise<AdminRole | null> {
        const hit = roleCache.get(id)
        if (hit && Date.now() - hit.at < ROLE_CACHE_TTL_MS) {
            return hit.role
        }

        const role = await AdminRole.findByPk(id)
        roleCache.set(id, { role, at: Date.now() })
        return role
    }
}
