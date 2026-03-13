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
import etherial from 'etherial';
import { Controller, Get } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { Op, fn, col, literal } from 'sequelize';
const getAdminLeaf = () => etherial.eth_admin_leaf;
const getDatabase = () => etherial.database;
let SettingsController = class SettingsController {
    /**
     * Get admin panel settings
     * Returns configuration values like logo, colors, app name, etc.
     */
    getSettings(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            const adminLeaf = getAdminLeaf();
            // Check if user has access to admin settings
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, 'settings', 'get'));
            if (!hasAccess) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 403, errors: ['forbidden'] });
            }
            const settings = (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.settings) || {};
            return (_d = (_c = res).success) === null || _d === void 0 ? void 0 : _d.call(_c, {
                status: 200,
                data: settings
            });
        });
    }
    /**
     * Get public settings (no authentication required)
     * Returns only public-facing settings like logo, colors, app name
     */
    getPublicSettings(_req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const adminLeaf = getAdminLeaf();
            const settings = (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.settings) || {};
            // Only return public-facing settings
            const publicSettings = {
                appName: settings.appName,
                logo: settings.logo,
                favicon: settings.favicon,
                primaryColor: settings.primaryColor,
                secondaryColor: settings.secondaryColor,
                accentColor: settings.accentColor,
                backgroundColor: settings.backgroundColor,
                textColor: settings.textColor,
                footerText: settings.footerText,
                copyrightText: settings.copyrightText
            };
            return (_b = (_a = res).success) === null || _b === void 0 ? void 0 : _b.call(_a, {
                status: 200,
                data: publicSettings
            });
        });
    }
    /**
     * Get full admin schema (collections, features, fields, actions)
     * This is the main endpoint for the frontend to build the entire admin UI
     */
    getSchema(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const adminLeaf = getAdminLeaf();
            // // Check if user can access admin
            // const hasAccess = await adminLeaf?.canAccessAdmin(req.user)
            // if (!hasAccess) {
            //     return (res as any).error?.({ status: 403, errors: ['forbidden'] })
            // }
            const schema = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getSchema();
            return (_b = (_a = res).success) === null || _b === void 0 ? void 0 : _b.call(_a, {
                status: 200,
                data: schema
            });
        });
    }
    /**
     * Get schema for a specific collection
     */
    getCollectionSchema(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            const adminLeaf = getAdminLeaf();
            // Check if user can access admin
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.canAccessAdmin(req.user));
            if (!hasAccess) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 403, errors: ['forbidden'] });
            }
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.serializeCollection(req.params.collection);
            if (!collection) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 404, errors: ['collection_not_found'] });
            }
            return (_f = (_e = res).success) === null || _f === void 0 ? void 0 : _f.call(_e, {
                status: 200,
                data: collection
            });
        });
    }
    /**
     * Get dashboard statistics for all collections
     * Returns counts and recent items for each collection
     *
     * Query params:
     * - months: number (default: 0) - Include monthly stats for the last N months (max 24)
     */
    getStats(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            const adminLeaf = getAdminLeaf();
            // Check if user can access admin
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.canAccessAdmin(req.user));
            if (!hasAccess) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 403, errors: ['forbidden'] });
            }
            const collections = (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.collections) || [];
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            // Parse months parameter (0 = no monthly stats, max 24)
            const monthsParam = Math.min(Math.max(parseInt(req.query.months || '0') || 0, 0), 24);
            const includeMonthly = monthsParam > 0;
            const collectionStats = [];
            let totalItems = 0;
            for (const collection of collections) {
                try {
                    const Model = collection.model;
                    if (!Model)
                        continue;
                    // Get total count
                    const count = yield Model.count();
                    totalItems += count;
                    // Check if model has created_at or createdAt field
                    const attributes = ((_c = Model.getAttributes) === null || _c === void 0 ? void 0 : _c.call(Model)) || Model.rawAttributes || {};
                    const hasCreatedAt = 'created_at' in attributes || 'createdAt' in attributes;
                    const createdAtField = 'created_at' in attributes ? 'created_at' : 'createdAt';
                    console.log(Model);
                    // Try to get recent count (items created in last 7 days)
                    let recentCount;
                    if (hasCreatedAt) {
                        try {
                            recentCount = yield Model.count({
                                where: {
                                    [createdAtField]: {
                                        [Op.gte]: sevenDaysAgo
                                    }
                                }
                            });
                        }
                        catch (_p) {
                            // Silently ignore if recentCount fails
                        }
                    }
                    // Get monthly stats if requested
                    let monthlyStats;
                    if (includeMonthly && hasCreatedAt) {
                        try {
                            monthlyStats = yield this.getMonthlyStats(Model, createdAtField, monthsParam);
                        }
                        catch (error) {
                            console.error(`[ETHAdminLeaf] Error getting monthly stats for ${collection.name}:`, error);
                        }
                    }
                    collectionStats.push({
                        name: collection.name,
                        label: ((_d = collection.meta) === null || _d === void 0 ? void 0 : _d.label) || collection.name,
                        labelPlural: ((_e = collection.meta) === null || _e === void 0 ? void 0 : _e.labelPlural) || ((_f = collection.meta) === null || _f === void 0 ? void 0 : _f.label) || collection.name,
                        icon: (_g = collection.meta) === null || _g === void 0 ? void 0 : _g.icon,
                        count,
                        recentCount,
                        monthlyStats
                    });
                }
                catch (error) {
                    console.error(`[ETHAdminLeaf] Error getting stats for collection ${collection.name}:`, error);
                    // Add collection with 0 count on error
                    collectionStats.push({
                        name: collection.name,
                        label: ((_h = collection.meta) === null || _h === void 0 ? void 0 : _h.label) || collection.name,
                        labelPlural: ((_j = collection.meta) === null || _j === void 0 ? void 0 : _j.labelPlural) || ((_k = collection.meta) === null || _k === void 0 ? void 0 : _k.label) || collection.name,
                        icon: (_l = collection.meta) === null || _l === void 0 ? void 0 : _l.icon,
                        count: 0
                    });
                }
            }
            const stats = {
                collections: collectionStats,
                totals: {
                    collections: collectionStats.length,
                    items: totalItems
                }
            };
            // Add period info if monthly stats requested
            if (includeMonthly) {
                const now = new Date();
                const fromDate = new Date(now.getFullYear(), now.getMonth() - monthsParam + 1, 1);
                stats.period = {
                    months: monthsParam,
                    from: fromDate.toISOString().slice(0, 7),
                    to: now.toISOString().slice(0, 7)
                };
            }
            return (_o = (_m = res).success) === null || _o === void 0 ? void 0 : _o.call(_m, {
                status: 200,
                data: stats
            });
        });
    }
    /**
     * Get monthly creation stats for a model
     */
    getMonthlyStats(Model, createdAtField, months) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const database = getDatabase();
            const dialect = ((_b = (_a = database === null || database === void 0 ? void 0 : database.sequelize) === null || _a === void 0 ? void 0 : _a.getDialect) === null || _b === void 0 ? void 0 : _b.call(_a)) || 'postgres';
            const now = new Date();
            const fromDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
            // Generate all months in the range (to fill gaps with 0)
            const allMonths = [];
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            for (let i = 0; i < months; i++) {
                const date = new Date(fromDate.getFullYear(), fromDate.getMonth() + i, 1);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const monthLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
                allMonths.push({ month: monthKey, label: monthLabel });
            }
            // Build query based on dialect
            let dateExpr;
            if (dialect === 'postgres') {
                dateExpr = fn('TO_CHAR', col(createdAtField), 'YYYY-MM');
            }
            else if (dialect === 'mysql' || dialect === 'mariadb') {
                dateExpr = fn('DATE_FORMAT', col(createdAtField), '%Y-%m');
            }
            else {
                // SQLite fallback
                dateExpr = fn('STRFTIME', '%Y-%m', col(createdAtField));
            }
            const results = yield Model.findAll({
                attributes: [
                    [dateExpr, 'month'],
                    [fn('COUNT', '*'), 'count']
                ],
                where: {
                    [createdAtField]: {
                        [Op.gte]: fromDate
                    }
                },
                group: [literal('1')], // Group by first column (month expression)
                order: [[literal('1'), 'ASC']],
                raw: true
            });
            // Create a map of results
            const resultsMap = new Map();
            for (const row of results) {
                resultsMap.set(row.month, parseInt(row.count) || 0);
            }
            // Fill in all months with counts (0 if no data)
            return allMonths.map(({ month, label }) => ({
                month,
                label,
                count: resultsMap.get(month) || 0
            }));
        });
    }
};
__decorate([
    Get('/admin/settings'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getSettings", null);
__decorate([
    Get('/admin/settings/public'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getPublicSettings", null);
__decorate([
    Get('/admin/schema')
    // @ShouldBeAuthenticated()
    ,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getSchema", null);
__decorate([
    Get('/admin/schema/:collection'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getCollectionSchema", null);
__decorate([
    Get('/admin/stats'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getStats", null);
SettingsController = __decorate([
    Controller()
], SettingsController);
export default SettingsController;
export const AvailableRouteMethods = ['getPublicSettings', 'getSettings', 'getSchema', 'getCollectionSchema', 'getStats'];
