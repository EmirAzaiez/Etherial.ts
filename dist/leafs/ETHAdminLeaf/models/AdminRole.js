var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var AdminRole_1;
import { Table, Column, Model, AllowNull, Default, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, AfterSave, AfterDestroy, } from 'etherial/components/database/provider';
/** Access checks read a role on every request: a short cache spares the query. */
const ROLE_CACHE_TTL_MS = 30000;
const roleCache = new Map();
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
let AdminRole = AdminRole_1 = class AdminRole extends Model {
    /** A role edited in the back-office applies within the request that follows. */
    static clearAccessCache() {
        roleCache.clear();
    }
    /** The role as the access checks read it, at most 30 seconds old. */
    static cached(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const hit = roleCache.get(id);
            if (hit && Date.now() - hit.at < ROLE_CACHE_TTL_MS) {
                return hit.role;
            }
            const role = yield AdminRole_1.findByPk(id);
            roleCache.set(id, { role, at: Date.now() });
            return role;
        });
    }
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AdminRole.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING),
    __metadata("design:type", String)
], AdminRole.prototype, "name", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], AdminRole.prototype, "description", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], AdminRole.prototype, "permissions", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], AdminRole.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date
    /** A role edited in the back-office applies within the request that follows. */
    )
], AdminRole.prototype, "updated_at", void 0);
__decorate([
    AfterSave,
    AfterDestroy,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminRole, "clearAccessCache", null);
AdminRole = AdminRole_1 = __decorate([
    Table({
        timestamps: true,
        tableName: 'admin_roles',
        freezeTableName: true,
    })
], AdminRole);
export { AdminRole };
