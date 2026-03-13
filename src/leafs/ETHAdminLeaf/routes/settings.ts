import etherial from 'etherial'
import { Request, Response } from 'etherial/components/http/provider'
import {
    Controller,
    Get
} from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'
import { Op, fn, col, literal } from 'sequelize'

const getAdminLeaf = () => (etherial as any).eth_admin_leaf
const getDatabase = () => (etherial as any).database

interface MonthlyData {
    month: string      // Format "2026-01"
    label: string      // Format "Jan 2026"
    count: number
}

interface CollectionStat {
    name: string
    label: string
    labelPlural: string
    icon?: string
    count: number
    recentCount?: number
    monthlyStats?: MonthlyData[]
}

interface DashboardStats {
    collections: CollectionStat[]
    totals: {
        collections: number
        items: number
    }
    period?: {
        months: number
        from: string
        to: string
    }
}

@Controller()
export default class SettingsController {
    /**
     * Get admin panel settings
     * Returns configuration values like logo, colors, app name, etc.
     */
    @Get('/admin/settings')
    @ShouldBeAuthenticated()
    async getSettings(req: Request & { user: any }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()

        // Check if user has access to admin settings
        const hasAccess = await adminLeaf?.checkAccess(req.user, 'settings', 'get')
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        const settings = adminLeaf?.settings || {}

        return (res as any).success?.({
            status: 200,
            data: settings
        })
    }

    /**
     * Get public settings (no authentication required)
     * Returns only public-facing settings like logo, colors, app name
     */
    @Get('/admin/settings/public')
    async getPublicSettings(_req: Request, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()
        const settings = adminLeaf?.settings || {}

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
        }

        return (res as any).success?.({
            status: 200,
            data: publicSettings
        })
    }

    /**
     * Get full admin schema (collections, features, fields, actions)
     * This is the main endpoint for the frontend to build the entire admin UI
     */
    @Get('/admin/schema')
    // @ShouldBeAuthenticated()
    async getSchema(req: Request & { user: any }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()

        // // Check if user can access admin
        // const hasAccess = await adminLeaf?.canAccessAdmin(req.user)
        // if (!hasAccess) {
        //     return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        // }

        const schema = adminLeaf?.getSchema()

        return (res as any).success?.({
            status: 200,
            data: schema
        })
    }

    /**
     * Get schema for a specific collection
     */
    @Get('/admin/schema/:collection')
    @ShouldBeAuthenticated()
    async getCollectionSchema(req: Request & { user: any; params: { collection: string } }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()

        // Check if user can access admin
        const hasAccess = await adminLeaf?.canAccessAdmin(req.user)
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        const collection = adminLeaf?.serializeCollection(req.params.collection)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        return (res as any).success?.({
            status: 200,
            data: collection
        })
    }

    /**
     * Get dashboard statistics for all collections
     * Returns counts and recent items for each collection
     *
     * Query params:
     * - months: number (default: 0) - Include monthly stats for the last N months (max 24)
     */
    @Get('/admin/stats')
    @ShouldBeAuthenticated()
    async getStats(req: Request & { user: any; query: { months?: string } }, res: Response): Promise<any> {
        const adminLeaf = getAdminLeaf()

        // Check if user can access admin
        const hasAccess = await adminLeaf?.canAccessAdmin(req.user)
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        const collections = adminLeaf?.collections || []
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        // Parse months parameter (0 = no monthly stats, max 24)
        const monthsParam = Math.min(Math.max(parseInt(req.query.months || '0') || 0, 0), 24)
        const includeMonthly = monthsParam > 0

        const collectionStats: CollectionStat[] = []
        let totalItems = 0

        for (const collection of collections) {
            try {
                const Model = collection.model
                if (!Model) continue

                // Get total count
                const count = await Model.count()
                totalItems += count

                // Check if model has created_at or createdAt field
                const attributes = Model.getAttributes?.() || Model.rawAttributes || {}
                const hasCreatedAt = 'created_at' in attributes || 'createdAt' in attributes
                const createdAtField = 'created_at' in attributes ? 'created_at' : 'createdAt'

                console.log(Model)

                // Try to get recent count (items created in last 7 days)
                let recentCount: number | undefined
                if (hasCreatedAt) {
                    try {
                        recentCount = await Model.count({
                            where: {
                                [createdAtField]: {
                                    [Op.gte]: sevenDaysAgo
                                }
                            }
                        })
                    } catch {
                        // Silently ignore if recentCount fails
                    }
                }

                // Get monthly stats if requested
                let monthlyStats: MonthlyData[] | undefined
                if (includeMonthly && hasCreatedAt) {
                    try {
                        monthlyStats = await this.getMonthlyStats(Model, createdAtField, monthsParam)
                    } catch (error) {
                        console.error(`[ETHAdminLeaf] Error getting monthly stats for ${collection.name}:`, error)
                    }
                }

                collectionStats.push({
                    name: collection.name,
                    label: collection.meta?.label || collection.name,
                    labelPlural: collection.meta?.labelPlural || collection.meta?.label || collection.name,
                    icon: collection.meta?.icon,
                    count,
                    recentCount,
                    monthlyStats
                })
            } catch (error) {
                console.error(`[ETHAdminLeaf] Error getting stats for collection ${collection.name}:`, error)
                // Add collection with 0 count on error
                collectionStats.push({
                    name: collection.name,
                    label: collection.meta?.label || collection.name,
                    labelPlural: collection.meta?.labelPlural || collection.meta?.label || collection.name,
                    icon: collection.meta?.icon,
                    count: 0
                })
            }
        }

        const stats: DashboardStats = {
            collections: collectionStats,
            totals: {
                collections: collectionStats.length,
                items: totalItems
            }
        }

        // Add period info if monthly stats requested
        if (includeMonthly) {
            const now = new Date()
            const fromDate = new Date(now.getFullYear(), now.getMonth() - monthsParam + 1, 1)
            stats.period = {
                months: monthsParam,
                from: fromDate.toISOString().slice(0, 7),
                to: now.toISOString().slice(0, 7)
            }
        }

        return (res as any).success?.({
            status: 200,
            data: stats
        })
    }

    /**
     * Get monthly creation stats for a model
     */
    private async getMonthlyStats(Model: any, createdAtField: string, months: number): Promise<MonthlyData[]> {
        const database = getDatabase()
        const dialect = database?.sequelize?.getDialect?.() || 'postgres'

        const now = new Date()
        const fromDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)

        // Generate all months in the range (to fill gaps with 0)
        const allMonths: { month: string; label: string }[] = []
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

        for (let i = 0; i < months; i++) {
            const date = new Date(fromDate.getFullYear(), fromDate.getMonth() + i, 1)
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            const monthLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`
            allMonths.push({ month: monthKey, label: monthLabel })
        }

        // Build query based on dialect
        let dateExpr: any
        if (dialect === 'postgres') {
            dateExpr = fn('TO_CHAR', col(createdAtField), 'YYYY-MM')
        } else if (dialect === 'mysql' || dialect === 'mariadb') {
            dateExpr = fn('DATE_FORMAT', col(createdAtField), '%Y-%m')
        } else {
            // SQLite fallback
            dateExpr = fn('STRFTIME', '%Y-%m', col(createdAtField))
        }

        const results = await Model.findAll({
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
        })

        // Create a map of results
        const resultsMap = new Map<string, number>()
        for (const row of results) {
            resultsMap.set(row.month, parseInt(row.count) || 0)
        }

        // Fill in all months with counts (0 if no data)
        return allMonths.map(({ month, label }) => ({
            month,
            label,
            count: resultsMap.get(month) || 0
        }))
    }
}

export const AvailableRouteMethods = ['getPublicSettings', 'getSettings', 'getSchema', 'getCollectionSchema', 'getStats'] as const
