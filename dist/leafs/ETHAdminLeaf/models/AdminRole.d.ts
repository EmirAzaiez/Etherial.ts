import { Model } from 'etherial/components/database/provider';
/** What a role may do on one collection. `view` is implied by every other one. */
export type CollectionPermission = 'view' | 'create' | 'update' | 'delete' | 'actions';
/**
 * The permissions a role grants, as edited by the back-office matrix
 * (`permissions-matrix` field). Anything absent is denied. Collection and page
 * names are the admin ones (`activity-bookings`, `appointments-calendar`, …).
 */
export interface RolePermissions {
    dashboard?: boolean;
    monitoring?: boolean;
    pages?: string[];
    collections?: Record<string, CollectionPermission[]>;
}
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
export declare class AdminRole extends Model<AdminRole> {
    id: number;
    name: string;
    description: string | null;
    permissions: RolePermissions;
    created_at: Date;
    updated_at: Date;
    /** A role edited in the back-office applies within the request that follows. */
    static clearAccessCache(): void;
    /** The role as the access checks read it, at most 30 seconds old. */
    static cached(id: number): Promise<AdminRole | null>;
}
