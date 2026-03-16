import etherial from 'etherial'
import { Request, Response } from 'express'
import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
} from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'
import { ActionContext, FieldDefinition, FieldHasMany, FieldBelongsToMany, BelongsToManyInput } from '../features/ActionRegistry.js'
import { CollectionStat } from '../features/CollectionConfig.js'
import { Op, fn, col } from 'sequelize'

const getAdminLeaf = () => (etherial as any).eth_admin_leaf

/**
 * Extract hasMany field definitions from collection fields
 * Resolves collection references to get the actual model
 */
function getHasManyFields(fields: FieldDefinition[] | undefined): Map<string, FieldHasMany & { label?: string; resolvedModel?: any }> {
    const result = new Map<string, FieldHasMany & { label?: string; resolvedModel?: any }>()
    if (!fields) return result

    const adminLeaf = getAdminLeaf()

    for (const field of fields) {
        if (field.type === 'hasMany' && field.hasMany) {
            const hm = field.hasMany

            // Resolve model from collection if not specified
            let resolvedModel = hm.model
            if (!resolvedModel && hm.collection) {
                const refCollection = adminLeaf?.getCollection(hm.collection)
                resolvedModel = refCollection?.model
            }

            result.set(field.name, {
                ...hm,
                label: field.label,
                resolvedModel
            })
        }
    }
    return result
}

/**
 * Extract belongsToMany field definitions from collection fields
 */
function getBelongsToManyFields(fields: FieldDefinition[] | undefined): Map<string, FieldBelongsToMany & { label?: string }> {
    const result = new Map<string, FieldBelongsToMany & { label?: string }>()
    if (!fields) return result

    for (const field of fields) {
        if (field.type === 'belongsToMany' && field.belongsToMany) {
            result.set(field.name, { ...field.belongsToMany, label: field.label })
        }
    }
    return result
}

/**
 * Build Sequelize includes from hasMany and belongsToMany fields
 * This auto-generates the include array so you don't need to specify it manually
 */
function buildIncludesFromRelations(
    fields: FieldDefinition[] | undefined,
    existingIncludes?: any[]
): any[] {
    const includes = existingIncludes ? [...existingIncludes] : []
    const hasManyFields = getHasManyFields(fields)
    const belongsToManyFields = getBelongsToManyFields(fields)

    // Add hasMany includes
    for (const [fieldName, config] of hasManyFields) {
        const model = config.resolvedModel || config.model
        const alreadyIncluded = includes.some(inc =>
            inc.as === fieldName ||
            inc.association === fieldName ||
            inc.model === model
        )
        if (!alreadyIncluded) {
            // Get fields for nested includes:
            // 1. From hasMany.fields if they are FieldDefinition[]
            // 2. Or from the referenced collection's fields
            let fieldsArray: FieldDefinition[] = []

            if (Array.isArray(config.fields) && config.fields.length > 0 && typeof config.fields[0] !== 'string') {
                fieldsArray = config.fields as FieldDefinition[]
            } else if (config.collection) {
                // Lookup fields from referenced collection
                const adminLeaf = getAdminLeaf()
                const refCollection = adminLeaf?.getCollection(config.collection)
                if (refCollection?.fields) {
                    fieldsArray = refCollection.fields
                }
            }

            const nestedIncludes = buildNestedIncludesForFields(fieldsArray)
            includes.push({
                association: fieldName,
                ...(nestedIncludes.length > 0 ? { include: nestedIncludes } : {})
            })
        }
    }

    // Add belongsToMany includes
    for (const [fieldName, config] of belongsToManyFields) {
        const alreadyIncluded = includes.some(inc =>
            inc.as === fieldName ||
            inc.association === fieldName ||
            inc.model === config.model
        )
        if (!alreadyIncluded) {
            includes.push({
                association: fieldName,
                // Include pivot fields if defined
                ...(config.pivotFields ? { through: { attributes: config.pivotFields.map(f => f.name) } } : {})
            })
        }
    }

    return includes
}

/**
 * Build nested includes for media/relation fields in hasMany
 */
function buildNestedIncludesForFields(fields: FieldDefinition[]): any[] {
    const includes: any[] = []

    for (const field of fields) {
        if (field.type === 'media' || field.type === 'image' || field.type === 'file') {
            const assocName = field.name.replace(/_id$/, '')
            includes.push({ association: assocName })
        }
        if (field.type === 'relation' && field.relation) {
            const assocName = field.name.replace(/_id$/, '')
            includes.push({ association: assocName })
        }
    }

    return includes
}

/**
 * Check if BelongsToManyInput contains pivot data (object format)
 */
function hasPivotData(items: BelongsToManyInput): items is Array<{ id: number; through?: Record<string, any> }> {
    return items.length > 0 && typeof items[0] === 'object'
}

/**
 * Process belongsToMany relations after parent record is created/updated
 * Supports two formats (backward compatible):
 * - Simple: [1, 2, 3] → uses Sequelize set()
 * - With pivot: [{id: 5, through: {role: 2}}, {id: 8, through: {role: 1}}] → uses junction model directly
 */
async function processBelongsToManyItems(
    record: any,
    fieldName: string,
    config: FieldBelongsToMany,
    items: BelongsToManyInput | undefined
): Promise<{ added: number; removed: number }> {
    const stats = { added: 0, removed: 0 }

    if (!items || !Array.isArray(items)) {
        return stats
    }

    try {
        if (items.length > 0 && hasPivotData(items)) {
            // Format with pivot data — use junction model directly
            const JunctionModel = typeof config.through === 'string' ? null : config.through
            if (!JunctionModel) {
                console.error(`[ETHAdminLeaf] Pivot fields require a junction model (not string) for ${fieldName}`)
                return stats
            }

            // Get current associations for stats
            const currentJunctions = await JunctionModel.findAll({
                where: { [config.foreignKey]: record.id },
                raw: true
            })
            const currentOtherIds = new Set(currentJunctions.map((j: any) => j[config.otherKey]))

            // Remove all existing junction rows
            await JunctionModel.destroy({ where: { [config.foreignKey]: record.id } })
            stats.removed = currentJunctions.length

            // Create new junction rows with pivot data
            for (const item of items) {
                await JunctionModel.create({
                    [config.foreignKey]: record.id,
                    [config.otherKey]: item.id,
                    ...(item.through || {})
                })
                if (!currentOtherIds.has(item.id)) {
                    stats.added++
                }
            }
            // Adjust stats: items that were re-created aren't truly "added"
            stats.added = items.filter(item => !currentOtherIds.has(item.id)).length
            stats.removed = currentJunctions.filter((j: any) => !items.some(item => item.id === j[config.otherKey])).length
        } else {
            // Simple ID format — use Sequelize's set method
            const itemIds = items as number[]
            const setMethodName = `set${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`

            if (typeof record[setMethodName] === 'function') {
                const getMethodName = `get${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`
                const currentItems: any[] = typeof record[getMethodName] === 'function'
                    ? await record[getMethodName]()
                    : []
                const currentIds = new Set<number>(currentItems.map((item: any) => item.id))

                await record[setMethodName](itemIds)

                const newIds = new Set<number>(itemIds)
                for (const id of itemIds) {
                    if (!currentIds.has(id)) stats.added++
                }
                for (const id of currentIds) {
                    if (!newIds.has(id as number)) stats.removed++
                }
            }
        }
    } catch (err: any) {
        console.error(`[ETHAdminLeaf] Error processing belongsToMany ${fieldName}:`, err.message)
    }

    return stats
}

/**
 * Process hasMany items after parent record is created/updated
 */
async function processHasManyItems(
    parentId: number,
    _fieldName: string,
    config: FieldHasMany & { resolvedModel?: any },
    items: any[] | undefined,
    isUpdate: boolean
): Promise<{ created: number; updated: number; deleted: number }> {
    const stats = { created: 0, updated: 0, deleted: 0 }

    if (!items || !Array.isArray(items)) {
        return stats
    }

    // Use resolvedModel (from collection) or direct model
    const Model = config.resolvedModel || config.model
    if (!Model) {
        console.error('[ETHAdminLeaf] No model found for hasMany field')
        return stats
    }

    if (isUpdate) {
        // For updates: sync items (create new, update existing, delete removed)
        const existingItems = await Model.findAll({
            where: { [config.foreignKey]: parentId }
        })
        const existingIds = new Set(existingItems.map((item: any) => item.id))
        const newIds = new Set(items.filter(item => item.id).map(item => item.id))

        // Delete items that are no longer in the list
        for (const existing of existingItems) {
            if (!newIds.has(existing.id)) {
                await existing.destroy()
                stats.deleted++
            }
        }

        // Create or update items
        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            const itemData = {
                ...item,
                [config.foreignKey]: parentId,
                [config.orderField || 'order']: i
            }

            if (item.id && existingIds.has(item.id)) {
                // Update existing
                const existing = existingItems.find((e: any) => e.id === item.id)
                if (existing) {
                    await existing.update(itemData)
                    stats.updated++
                }
            } else {
                // Create new (remove id if it was set but doesn't exist)
                delete itemData.id
                await Model.create(itemData)
                stats.created++
            }
        }
    } else {
        // For creates: just create all items
        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            const itemData = {
                ...item,
                [config.foreignKey]: parentId,
                [config.orderField || 'order']: i
            }
            delete itemData.id // Remove any client-side temp id
            await Model.create(itemData)
            stats.created++
        }
    }

    return stats
}

/**
 * Mask a string value for secure display
 * Shows first 5 chars, 5 dots, last 5 chars
 * For shorter strings, adjusts accordingly
 */
function maskSecureValue(value: string): string {
    if (!value || typeof value !== 'string') return value

    const len = value.length
    if (len <= 10) {
        // Too short to mask meaningfully
        return value.substring(0, 2) + '•••' + value.substring(len - 2)
    }

    const showChars = Math.min(5, Math.floor(len / 3))
    const start = value.substring(0, showChars)
    const end = value.substring(len - showChars)
    return `${start}•••••${end}`
}

/**
 * Transform field values for Admin API responses:
 * - Enum fields: convert numeric values to labels
 * - Secure fields: mask sensitive data
 */
function transformFields(items: any[], fields: any[]): any[] {
    // Build maps for transformations
    const optionsMap: Record<string, Record<any, string>> = {}
    const secureFields: Set<string> = new Set()
    const jsonFields: Set<string> = new Set()
    const relationFields: Map<string, { collection: string; displayField: string }> = new Map()

    for (const field of fields) {
        // Collect enum options
        if (field.options && Array.isArray(field.options)) {
            optionsMap[field.name] = {}
            for (const opt of field.options) {
                optionsMap[field.name][opt.value] = opt.label
            }
        }
        // Collect secure fields
        if (field.secure) {
            secureFields.add(field.name)
        }
        // Collect json fields
        if (field.type === 'json') {
            jsonFields.add(field.name)
        }
        // Collect relation fields
        if (field.type === 'relation' && field.relation) {
            relationFields.set(field.name, field.relation)
        }
    }

    // Transform each item
    return items.map(item => {
        let json = item.toJSON ? item.toJSON() : { ...item }

        // Apply custom field type afterRead hooks
        json = applyAfterRead(json, fields)

        // Apply enum transformations
        for (const [fieldName, valueToLabel] of Object.entries(optionsMap)) {
            if (json[fieldName] !== undefined && valueToLabel[json[fieldName]]) {
                json[fieldName] = valueToLabel[json[fieldName]]
            }
        }

        // Apply secure masking
        for (const fieldName of secureFields) {
            if (json[fieldName] !== undefined) {
                json[fieldName] = maskSecureValue(json[fieldName])
            }
        }

        // Format JSON fields for readable display
        for (const fieldName of jsonFields) {
            const val = json[fieldName]
            if (val == null) continue
            if (Array.isArray(val)) {
                json[fieldName] = val.map((item: any) => {
                    if (typeof item === 'object') {
                        // Show most meaningful values: name, value, url, key
                        return item.name || item.value || item.url || item.key || JSON.stringify(item)
                    }
                    return String(item)
                })
            } else if (typeof val === 'object') {
                json[fieldName] = JSON.stringify(val, null, 2)
            }
        }

        // Resolve relation display fields (user_id: 5 → user_id: "email@test.com")
        for (const [fieldName, relConfig] of relationFields) {
            const associationName = fieldName.replace(/_id$/, '')
            const related = json[associationName]
            if (related && related[relConfig.displayField]) {
                json[fieldName] = related[relConfig.displayField]
            }
        }

        return json
    })
}

/**
 * Get CDN URL from ETHMediaLeaf config
 */
function getCdnUrl(): string | undefined {
    try {
        const etherial = require('etherial').default
        return etherial?.eth_media_leaf?.config?.cdn_url
    } catch {
        return undefined
    }
}

/**
 * Check if an object looks like a Media record
 */
function isMediaObject(obj: any): boolean {
    return obj &&
        typeof obj === 'object' &&
        typeof obj.key === 'string' &&
        typeof obj.folder === 'string' &&
        (obj.mime_type || obj.file_size !== undefined)
}

/**
 * Recursively transform all Media objects in data to include CDN URL
 * This adds a `url` property to any object that looks like a Media record
 */
function transformMediaUrls(data: any, cdnUrl?: string): any {
    if (!cdnUrl) {
        cdnUrl = getCdnUrl()
    }

    if (!cdnUrl || !data) return data

    // Handle arrays
    if (Array.isArray(data)) {
        return data.map(item => transformMediaUrls(item, cdnUrl))
    }

    // Handle objects
    if (typeof data === 'object') {
        // Convert Sequelize instance to plain object
        const obj = data.toJSON ? data.toJSON() : { ...data }

        // Check if this object is a Media
        if (isMediaObject(obj) && !obj.url) {
            obj.url = `${cdnUrl.replace(/\/$/, '')}/${obj.key}`
        }

        // Recursively transform nested objects
        for (const key of Object.keys(obj)) {
            if (obj[key] && typeof obj[key] === 'object') {
                obj[key] = transformMediaUrls(obj[key], cdnUrl)
            }
        }

        return obj
    }

    return data
}

/**
 * Process custom field types for create/update operations
 * Runs beforeSave and validate hooks for any fields that use custom types
 */
async function processCustomFieldTypes(
    data: Record<string, any>,
    fields: FieldDefinition[] | undefined,
    phase: 'beforeSave' | 'validate'
): Promise<Record<string, any>> {
    if (!fields) return data

    const adminLeaf = getAdminLeaf()
    const result = { ...data }

    for (const field of fields) {
        const customType = adminLeaf?.getCustomFieldType(field.type)
        if (!customType) continue

        const value = result[field.name]
        if (value === undefined) continue

        if (phase === 'beforeSave' && customType.beforeSave) {
            result[field.name] = customType.beforeSave(value, field)
        }

        if (phase === 'validate' && customType.validate) {
            await customType.validate(value, field)
        }
    }

    return result
}

/**
 * Apply afterRead hooks for custom field types
 */
function applyAfterRead(
    data: Record<string, any>,
    fields: FieldDefinition[] | undefined
): Record<string, any> {
    if (!fields) return data

    const adminLeaf = getAdminLeaf()
    const result = { ...data }

    for (const field of fields) {
        const customType = adminLeaf?.getCustomFieldType(field.type)
        if (!customType?.afterRead) continue

        if (result[field.name] !== undefined) {
            result[field.name] = customType.afterRead(result[field.name], field)
        }
    }

    return result
}

/**
 * Parse advanced filters from query parameters
 * Supports Django-style double-underscore operators:
 * - field=value → exact match (backward compatible)
 * - field__ne=value → not equal
 * - field__gt, field__gte, field__lt, field__lte → comparisons
 * - field__between=start,end → range
 * - field__in=val1,val2,val3 → IN
 * - field__null=true/false → IS NULL / IS NOT NULL
 * - field__like=pattern → LIKE
 */
function parseAdvancedFilters(filters: Record<string, any>, allowedFilters: string[]): Record<string, any> {
    const where: any = {}

    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === '') continue

        // Check for operator suffix
        const parts = key.split('__')
        const fieldName = parts[0]
        const operator = parts[1]

        // Whitelist check on the base field name
        if (!allowedFilters.includes(fieldName)) continue

        if (!operator) {
            // Simple exact match (backward compatible)
            where[fieldName] = value
            continue
        }

        switch (operator) {
            case 'ne':
                where[fieldName] = { [Op.ne]: value }
                break
            case 'gt':
                where[fieldName] = { ...where[fieldName], [Op.gt]: value }
                break
            case 'gte':
                where[fieldName] = { ...where[fieldName], [Op.gte]: value }
                break
            case 'lt':
                where[fieldName] = { ...where[fieldName], [Op.lt]: value }
                break
            case 'lte':
                where[fieldName] = { ...where[fieldName], [Op.lte]: value }
                break
            case 'between': {
                const [start, end] = String(value).split(',')
                if (start && end) {
                    where[fieldName] = { [Op.between]: [start.trim(), end.trim()] }
                }
                break
            }
            case 'in': {
                const values = String(value).split(',').map(v => v.trim())
                where[fieldName] = { [Op.in]: values }
                break
            }
            case 'null':
                where[fieldName] = String(value) === 'true' ? null : { [Op.ne]: null }
                break
            case 'like':
                where[fieldName] = { [Op.like]: value }
                break
            default:
                // Unknown operator, treat as exact match on full key
                break
        }
    }

    return where
}

/**
 * Escape a value for CSV output
 */
function escapeCsvValue(value: any): string {
    if (value === null || value === undefined) return ''
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

/**
 * Admin Collections Controller
 * Single controller handling all CRUD operations for all collections
 */
@Controller()
export default class AdminCollectionsController {

    /**
     * GET /admin/collections/:collection
     * List records from a collection
     */
    @Get('/admin/collections/:collection')
    @ShouldBeAuthenticated()
    async list(
        req: Request & { user: any; params: { collection: string }; query: any },
        res: Response
    ): Promise<any> {
        const { collection: collectionName } = req.params
        const adminLeaf = getAdminLeaf()

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        // Check access
        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, 'list')
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        try {
            const { limit = 25, offset = 0, sort, order, search, showDeleted, ...filters } = req.query
            const listView = collection.views?.list

            // Build where clause from advanced filters
            const allowedFilters = listView?.filters || []
            const where: any = parseAdvancedFilters(filters, allowedFilters)

            // Build search clause
            if (search && listView?.search && listView.search.length > 0) {
                where[Op.or] = listView.search.map((field: string) => ({
                    [field]: { [Op.iLike]: `%${search}%` }
                }))
            }

            // Build order
            let orderClause: [string, 'ASC' | 'DESC'][] = []
            if (sort) {
                orderClause = [[sort as string, (order as string || 'ASC').toUpperCase() as 'ASC' | 'DESC']]
            } else if (listView?.sort) {
                orderClause = [[listView.sort.field, listView.sort.direction.toUpperCase() as 'ASC' | 'DESC']]
            } else {
                orderClause = [['created_at', 'DESC']]
            }

            // Soft delete: show deleted records if requested and collection supports it
            const paranoidOption = collection.softDelete?.enabled && showDeleted === 'true'
                ? { paranoid: false }
                : {}

            const result = await collection.model.findAndCountAll({
                where,
                attributes: listView?.fields,
                include: listView?.include || [],
                order: orderClause,
                limit: Number(limit),
                offset: Number(offset),
                ...paranoidOption
            })

            // Transform field values for admin display (enums, secure fields)
            const transformedItems = transformFields(result.rows, collection.fields || [])
            // Add CDN URLs to all media objects
            const itemsWithUrls = transformMediaUrls(transformedItems)

            return (res as any).success?.({
                status: 200,
                data: { items: itemsWithUrls, total: result.count }
            })
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] List error for ${collectionName}:`, err)
            return (res as any).error?.({ status: 400, errors: [err.message] })
        }
    }

    /**
     * GET /admin/collections/:collection/:id
     * Show a single record
     */
    @Get('/admin/collections/:collection/:id(\\d+)')
    @ShouldBeAuthenticated()
    async show(
        req: Request & { user: any; params: { collection: string; id: string }; query: any },
        res: Response
    ): Promise<any> {
        const { collection: collectionName, id } = req.params
        const { raw } = req.query
        const adminLeaf = getAdminLeaf()

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, 'show')
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        try {
            const showView = collection.views?.show

            // Auto-generate includes from hasMany + belongsToMany fields + any manual includes
            const includes = buildIncludesFromRelations(collection.fields, showView?.include)

            const record = await collection.model.findByPk(id, {
                include: includes
            })

            if (!record) {
                return (res as any).error?.({ status: 404, errors: ['not_found'] })
            }

            // raw=true: skip enum/secure transformations (used by edit forms to get raw values)
            if (raw === 'true') {
                const rawData = record.toJSON ? record.toJSON() : { ...record }
                const recordWithUrls = transformMediaUrls(rawData)
                return (res as any).success?.({ status: 200, data: recordWithUrls })
            }

            // Transform field values for admin display (enums, secure fields)
            const [transformedRecord] = transformFields([record], collection.fields || [])
            // Add CDN URLs to all media objects
            const recordWithUrls = transformMediaUrls(transformedRecord)

            return (res as any).success?.({ status: 200, data: recordWithUrls })
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] Show error for ${collectionName}:`, err)
            return (res as any).error?.({ status: 400, errors: [err.message] })
        }
    }

    /**
     * GET /admin/collections/:collection/:id/collections/:subName
     * Get sub-collection records
     * Supports both manual collections config AND auto-generated from hasMany fields
     */
    @Get('/admin/collections/:collection/:id(\\d+)/collections/:subName')
    @ShouldBeAuthenticated()
    async subCollection(
        req: Request & { user: any; params: { collection: string; id: string; subName: string }; query: any },
        res: Response
    ): Promise<any> {
        const { collection: collectionName, id, subName } = req.params
        const adminLeaf = getAdminLeaf()

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, 'show')
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        // First check manual collections config
        let subConfig = collection.views?.show?.collections?.find((s: any) => s.name === subName)

        // If not found, check hasMany fields (auto-generated sub-collections)
        if (!subConfig) {
            const hasManyFields = getHasManyFields(collection.fields)
            const hasManyConfig = hasManyFields.get(subName)
            if (hasManyConfig) {
                // Get model from resolvedModel (collection lookup) or direct model
                const model = hasManyConfig.resolvedModel || hasManyConfig.model

                // Get field names from fields config
                let fieldNames: string[] = []
                if (hasManyConfig.fields && Array.isArray(hasManyConfig.fields)) {
                    if (typeof hasManyConfig.fields[0] === 'string') {
                        fieldNames = hasManyConfig.fields as string[]
                    } else {
                        fieldNames = (hasManyConfig.fields as FieldDefinition[]).map((f: FieldDefinition) => f.name)
                    }
                }

                // Convert hasMany to subConfig format
                subConfig = {
                    name: subName,
                    title: hasManyConfig.label || subName,
                    model,
                    foreignKey: hasManyConfig.foreignKey,
                    fields: fieldNames,
                    sort: hasManyConfig.sortable ? { field: hasManyConfig.orderField || 'order', direction: 'asc' as const } : undefined
                }
            }
        }

        if (!subConfig) {
            return (res as any).error?.({ status: 404, errors: ['sub_collection_not_found'] })
        }

        try {
            const { limit = subConfig.limit || 25, offset = 0 } = req.query
            const order: [string, 'ASC' | 'DESC'][] = subConfig.sort
                ? [[subConfig.sort.field, subConfig.sort.direction.toUpperCase() as 'ASC' | 'DESC']]
                : [['created_at', 'DESC']]

            // Build includes for nested relations (media, etc)
            const hasManyFields = getHasManyFields(collection.fields)
            const hasManyConfig = hasManyFields.get(subName)

            // Get field definitions (handling string[] vs FieldDefinition[])
            let fieldsForIncludes: FieldDefinition[] = []
            if (hasManyConfig?.fields && Array.isArray(hasManyConfig.fields)) {
                if (typeof hasManyConfig.fields[0] !== 'string') {
                    fieldsForIncludes = hasManyConfig.fields as FieldDefinition[]
                }
            }
            const nestedIncludes = buildNestedIncludesForFields(fieldsForIncludes)

            // M:M: query via junction table, then fetch related model
            let items
            if (subConfig.through && subConfig.otherKey) {
                const junctionRows = await subConfig.through.findAll({
                    where: { [subConfig.foreignKey]: id },
                    attributes: [subConfig.otherKey],
                    raw: true,
                })
                const relatedIds = junctionRows.map((r: any) => r[subConfig.otherKey]).filter(Boolean)

                if (relatedIds.length === 0) {
                    items = { rows: [], count: 0 }
                } else {
                    items = await subConfig.model.findAndCountAll({
                        where: { id: relatedIds },
                        include: nestedIncludes,
                        order,
                        limit: Number(limit),
                        offset: Number(offset),
                    })
                }
            } else {
                items = await subConfig.model.findAndCountAll({
                    where: { [subConfig.foreignKey]: id },
                    include: nestedIncludes,
                    order,
                    limit: Number(limit),
                    offset: Number(offset)
                })
            }

            // Try to get the sub-collection's registered fields for transformation
            const subCollection = adminLeaf?.getCollection(subName)
            // Prefer collection fields, then hasMany fields if they're FieldDefinition[]
            let subFields: FieldDefinition[] = subCollection?.fields || []
            if (subFields.length === 0 && fieldsForIncludes.length > 0) {
                subFields = fieldsForIncludes
            }
            const transformedItems = transformFields(items.rows, subFields)
            // Add CDN URLs to all media objects
            const itemsWithUrls = transformMediaUrls(transformedItems)

            return (res as any).success?.({
                status: 200,
                data: { items: itemsWithUrls, total: items.count }
            })
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] SubCollection error:`, err)
            return (res as any).error?.({ status: 400, errors: [err.message] })
        }
    }

    /**
     * POST /admin/collections/:collection
     * Create a new record
     */
    @Post('/admin/collections/:collection')
    @ShouldBeAuthenticated()
    async create(
        req: Request & { user: any; params: { collection: string }; body: any },
        res: Response
    ): Promise<any> {
        const { collection: collectionName } = req.params
        const adminLeaf = getAdminLeaf()

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, 'create')
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        try {
            let data = { ...req.body }
            const resolvedHooks = adminLeaf.getResolvedHooks(collectionName)

            // Extract hasMany fields from data
            const hasManyFields = getHasManyFields(collection.fields)
            const hasManyData: Map<string, any[]> = new Map()

            for (const [fieldName] of hasManyFields) {
                if (data[fieldName] !== undefined) {
                    hasManyData.set(fieldName, data[fieldName])
                    delete data[fieldName]
                }
            }

            // Extract belongsToMany fields from data
            const belongsToManyFields = getBelongsToManyFields(collection.fields)
            const belongsToManyData: Map<string, BelongsToManyInput> = new Map()

            for (const [fieldName] of belongsToManyFields) {
                if (data[fieldName] !== undefined) {
                    belongsToManyData.set(fieldName, data[fieldName])
                    delete data[fieldName]
                }
            }

            // Run beforeCreate hook
            if (resolvedHooks?.beforeCreate) {
                data = await resolvedHooks.beforeCreate(data, req) ?? data
            }

            // Process custom field types: validate then beforeSave
            data = await processCustomFieldTypes(data, collection.fields, 'validate')
            data = await processCustomFieldTypes(data, collection.fields, 'beforeSave')

            // Create parent record
            const record = await collection.model.create(data)

            // Create hasMany items
            for (const [fieldName, items] of hasManyData) {
                const hmConfig = hasManyFields.get(fieldName)!
                await processHasManyItems(record.id, fieldName, hmConfig, items, false)
            }

            // Sync belongsToMany relations
            for (const [fieldName, itemIds] of belongsToManyData) {
                const btmConfig = belongsToManyFields.get(fieldName)!
                await processBelongsToManyItems(record, fieldName, btmConfig, itemIds)
            }

            // Run afterCreate hook
            if (resolvedHooks?.afterCreate) {
                await resolvedHooks.afterCreate(record, req)
            }

            // Reload with relations
            const reloadIncludes: any[] = []
            if (hasManyData.size > 0) {
                reloadIncludes.push(...Array.from(hasManyFields.keys()).map(name => ({ association: name })))
            }
            if (belongsToManyData.size > 0) {
                reloadIncludes.push(...Array.from(belongsToManyFields.keys()).map(name => ({ association: name })))
            }
            if (reloadIncludes.length > 0) {
                await record.reload({ include: reloadIncludes })
            }

            return (res as any).success?.({ status: 201, data: record })
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] Create error for ${collectionName}:`, err)
            return (res as any).error?.({ status: 400, errors: err.errors?.map((e: any) => e.message) || [err.message] })
        }
    }

    /**
     * PUT /admin/collections/:collection/:id
     * Update a record
     */
    @Put('/admin/collections/:collection/:id(\\d+)')
    @ShouldBeAuthenticated()
    async update(
        req: Request & { user: any; params: { collection: string; id: string }; body: any },
        res: Response
    ): Promise<any> {
        const { collection: collectionName, id } = req.params
        const adminLeaf = getAdminLeaf()

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, 'update')
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        try {
            const record = await collection.model.findByPk(id)
            if (!record) {
                return (res as any).error?.({ status: 404, errors: ['not_found'] })
            }

            let data = { ...req.body }
            const resolvedHooks = adminLeaf.getResolvedHooks(collectionName)

            // Extract hasMany fields from data
            const hasManyFields = getHasManyFields(collection.fields)
            const hasManyData: Map<string, any[]> = new Map()

            for (const [fieldName] of hasManyFields) {
                if (data[fieldName] !== undefined) {
                    hasManyData.set(fieldName, data[fieldName])
                    delete data[fieldName]
                }
            }

            // Extract belongsToMany fields from data
            const belongsToManyFields = getBelongsToManyFields(collection.fields)
            const belongsToManyData: Map<string, BelongsToManyInput> = new Map()

            for (const [fieldName] of belongsToManyFields) {
                if (data[fieldName] !== undefined) {
                    belongsToManyData.set(fieldName, data[fieldName])
                    delete data[fieldName]
                }
            }

            // Run beforeUpdate hook
            if (resolvedHooks?.beforeUpdate) {
                data = await resolvedHooks.beforeUpdate(record, data, req) ?? data
            }

            // Process custom field types: validate then beforeSave
            data = await processCustomFieldTypes(data, collection.fields, 'validate')
            data = await processCustomFieldTypes(data, collection.fields, 'beforeSave')

            // Update parent record
            await record.update(data)

            // Sync hasMany items
            for (const [fieldName, items] of hasManyData) {
                const hmConfig = hasManyFields.get(fieldName)!
                await processHasManyItems(record.id, fieldName, hmConfig, items, true)
            }

            // Sync belongsToMany relations
            for (const [fieldName, itemIds] of belongsToManyData) {
                const btmConfig = belongsToManyFields.get(fieldName)!
                await processBelongsToManyItems(record, fieldName, btmConfig, itemIds)
            }

            // Run afterUpdate hook
            if (resolvedHooks?.afterUpdate) {
                await resolvedHooks.afterUpdate(record, req)
            }

            // Reload with relations
            const reloadIncludes: any[] = []
            if (hasManyData.size > 0) {
                reloadIncludes.push(...Array.from(hasManyFields.keys()).map(name => ({ association: name })))
            }
            if (belongsToManyData.size > 0) {
                reloadIncludes.push(...Array.from(belongsToManyFields.keys()).map(name => ({ association: name })))
            }
            if (reloadIncludes.length > 0) {
                await record.reload({ include: reloadIncludes })
            }

            return (res as any).success?.({ status: 200, data: record })
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] Update error for ${collectionName}:`, err)
            return (res as any).error?.({ status: 400, errors: err.errors?.map((e: any) => e.message) || [err.message] })
        }
    }

    /**
     * DELETE /admin/collections/:collection/:id
     * Delete a record
     */
    @Delete('/admin/collections/:collection/:id(\\d+)')
    @ShouldBeAuthenticated()
    async delete(
        req: Request & { user: any; params: { collection: string; id: string } },
        res: Response
    ): Promise<any> {
        const { collection: collectionName, id } = req.params
        const adminLeaf = getAdminLeaf()

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, 'delete')
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        try {
            const record = await collection.model.findByPk(id)
            if (!record) {
                return (res as any).error?.({ status: 404, errors: ['not_found'] })
            }

            const resolvedHooks = adminLeaf.getResolvedHooks(collectionName)

            // Run beforeDelete hook
            if (resolvedHooks?.beforeDelete) {
                const canDelete = await resolvedHooks.beforeDelete(record, req)
                if (canDelete === false) {
                    return (res as any).error?.({ status: 400, errors: ['delete_prevented'] })
                }
            }

            await record.destroy()

            // Run afterDelete hook
            if (resolvedHooks?.afterDelete) {
                await resolvedHooks.afterDelete(record, req)
            }

            return (res as any).success?.({ status: 200, data: { deleted: true } })
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] Delete error for ${collectionName}:`, err)
            return (res as any).error?.({ status: 400, errors: [err.message] })
        }
    }

    /**
     * GET /admin/collections/:collection/:id/collections/:subName/:subId
     * Show a single sub-collection record
     */
    @Get('/admin/collections/:collection/:id(\\d+)/collections/:subName/:subId(\\d+)')
    @ShouldBeAuthenticated()
    async showSubCollectionItem(
        req: Request & { user: any; params: { collection: string; id: string; subName: string; subId: string } },
        res: Response
    ): Promise<any> {
        const { collection: collectionName, id, subName, subId } = req.params
        const adminLeaf = getAdminLeaf()

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, 'show')
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        const subConfig = collection.views?.show?.collections?.find((s: any) => s.name === subName)
        if (!subConfig) {
            return (res as any).error?.({ status: 404, errors: ['sub_collection_not_found'] })
        }

        try {
            const record = await subConfig.model.findOne({
                where: {
                    id: subId,
                    [subConfig.foreignKey]: id
                }
            })

            if (!record) {
                return (res as any).error?.({ status: 404, errors: ['not_found'] })
            }

            return (res as any).success?.({ status: 200, data: record })
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] ShowSubCollectionItem error:`, err)
            return (res as any).error?.({ status: 400, errors: [err.message] })
        }
    }

    /**
     * PUT /admin/collections/:collection/:id/collections/:subName/:subId
     * Update a sub-collection record
     */
    @Put('/admin/collections/:collection/:id(\\d+)/collections/:subName/:subId(\\d+)')
    @ShouldBeAuthenticated()
    async updateSubCollectionItem(
        req: Request & { user: any; params: { collection: string; id: string; subName: string; subId: string }; body: any },
        res: Response
    ): Promise<any> {
        const { collection: collectionName, id, subName, subId } = req.params
        const adminLeaf = getAdminLeaf()

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, 'update')
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        const subConfig = collection.views?.show?.collections?.find((s: any) => s.name === subName)
        if (!subConfig) {
            return (res as any).error?.({ status: 404, errors: ['sub_collection_not_found'] })
        }

        try {
            const record = await subConfig.model.findOne({
                where: {
                    id: subId,
                    [subConfig.foreignKey]: id
                }
            })

            if (!record) {
                return (res as any).error?.({ status: 404, errors: ['not_found'] })
            }

            await record.update(req.body)

            return (res as any).success?.({ status: 200, data: record })
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] UpdateSubCollectionItem error:`, err)
            return (res as any).error?.({ status: 400, errors: err.errors?.map((e: any) => e.message) || [err.message] })
        }
    }

    /**
     * DELETE /admin/collections/:collection/:id/collections/:subName/:subId
     * Delete a sub-collection record
     */
    @Delete('/admin/collections/:collection/:id(\\d+)/collections/:subName/:subId(\\d+)')
    @ShouldBeAuthenticated()
    async deleteSubCollectionItem(
        req: Request & { user: any; params: { collection: string; id: string; subName: string; subId: string } },
        res: Response
    ): Promise<any> {
        const { collection: collectionName, id, subName, subId } = req.params
        const adminLeaf = getAdminLeaf()

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, 'delete')
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        const subConfig = collection.views?.show?.collections?.find((s: any) => s.name === subName)
        if (!subConfig) {
            return (res as any).error?.({ status: 404, errors: ['sub_collection_not_found'] })
        }

        try {
            const record = await subConfig.model.findOne({
                where: {
                    id: subId,
                    [subConfig.foreignKey]: id
                }
            })

            if (!record) {
                return (res as any).error?.({ status: 404, errors: ['not_found'] })
            }

            await record.destroy()

            return (res as any).success?.({ status: 200, data: { deleted: true } })
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] DeleteSubCollectionItem error:`, err)
            return (res as any).error?.({ status: 400, errors: [err.message] })
        }
    }

    /**
     * POST /admin/collections/:collection/:id/collections/:subName/:subId/actions
     * Execute an action on a sub-collection record
     */
    @Post('/admin/collections/:collection/:id(\\d+)/collections/:subName/:subId(\\d+)/actions')
    @ShouldBeAuthenticated()
    async executeSubCollectionAction(
        req: Request & { user: any; params: { collection: string; id: string; subName: string; subId: string }; body: any },
        res: Response
    ): Promise<any> {
        const { collection: collectionName, id, subName, subId } = req.params
        const { action: actionName, ...formData } = req.body
        const adminLeaf = getAdminLeaf()

        if (!actionName) {
            return (res as any).error?.({ status: 400, errors: ['action_required'] })
        }

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        const subConfig = collection.views?.show?.collections?.find((s: any) => s.name === subName)
        if (!subConfig) {
            return (res as any).error?.({ status: 404, errors: ['sub_collection_not_found'] })
        }

        // Check if action is allowed on this sub-collection
        if (!subConfig.actions?.includes(actionName)) {
            return (res as any).error?.({ status: 400, errors: ['action_not_allowed'] })
        }

        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, actionName)
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        const record = await subConfig.model.findOne({
            where: {
                id: subId,
                [subConfig.foreignKey]: id
            }
        })

        if (!record) {
            return (res as any).error?.({ status: 404, errors: ['record_not_found'] })
        }

        const context: ActionContext = {
            collection,
            model: subConfig.model,
            parentId: id,
            subCollection: subName
        }

        const result = await adminLeaf?.actions?.execute(actionName, record, formData, req, context)

        if (!result?.success) {
            return (res as any).error?.({ status: 400, errors: [result?.error || 'action_failed'] })
        }

        return (res as any).success?.({ status: 200, data: result.data })
    }

    /**
     * POST /admin/collections/:collection/:id/actions
     * Execute an action on a record
     */
    @Post('/admin/collections/:collection/:id(\\d+)/actions')
    @ShouldBeAuthenticated()
    async executeAction(
        req: Request & { user: any; params: { collection: string; id: string }; body: any },
        res: Response
    ): Promise<any> {
        const { collection: collectionName, id } = req.params
        const { action: actionName, ...formData } = req.body
        const adminLeaf = getAdminLeaf()

        if (!actionName) {
            return (res as any).error?.({ status: 400, errors: ['action_required'] })
        }

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        if (!collection.actions?.includes(actionName)) {
            return (res as any).error?.({ status: 400, errors: ['action_not_allowed'] })
        }

        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, actionName)
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        const record = await collection.model.findByPk(id)
        if (!record) {
            return (res as any).error?.({ status: 404, errors: ['record_not_found'] })
        }

        const context: ActionContext = {
            collection,
            model: collection.model
        }

        const result = await adminLeaf?.actions?.execute(actionName, record, formData, req, context)

        if (!result?.success) {
            return (res as any).error?.({ status: 400, errors: [result?.error || 'action_failed'] })
        }

        return (res as any).success?.({ status: 200, data: result.data })
    }

    /**
     * GET /admin/collections/:collection/search
     * Search/autocomplete endpoint for a collection
     */
    @Get('/admin/collections/:collection/search')
    @ShouldBeAuthenticated()
    async search(
        req: Request & { user: any; params: { collection: string }; query: any },
        res: Response
    ): Promise<any> {
        const { collection: collectionName } = req.params
        const adminLeaf = getAdminLeaf()

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, 'list')
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        try {
            const { q = '', fields: fieldsParam, limit = 20 } = req.query
            const listView = collection.views?.list

            // Determine search fields
            const searchFields: string[] = fieldsParam
                ? String(fieldsParam).split(',').map((f: string) => f.trim())
                : (listView?.search || [])

            if (searchFields.length === 0 || !q) {
                return (res as any).success?.({ status: 200, data: [] })
            }

            const where: any = {
                [Op.or]: searchFields.map((field: string) => ({
                    [field]: { [Op.iLike]: `%${q}%` }
                }))
            }

            const cappedLimit = Math.min(Number(limit), 50)

            const results = await collection.model.findAll({
                where,
                attributes: ['id', ...searchFields],
                limit: cappedLimit,
                order: [['id', 'ASC']]
            })

            const items = results.map((r: any) => {
                const json = r.toJSON ? r.toJSON() : { ...r }
                return json
            })

            return (res as any).success?.({ status: 200, data: items })
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] Search error for ${collectionName}:`, err)
            return (res as any).error?.({ status: 400, errors: [err.message] })
        }
    }

    /**
     * GET /admin/collections/:collection/export
     * Export collection data as CSV or JSON
     */
    @Get('/admin/collections/:collection/export')
    @ShouldBeAuthenticated()
    async export(
        req: Request & { user: any; params: { collection: string }; query: any },
        res: Response
    ): Promise<any> {
        const { collection: collectionName } = req.params
        const adminLeaf = getAdminLeaf()

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        if (!collection.exportable) {
            return (res as any).error?.({ status: 403, errors: ['export_not_enabled'] })
        }

        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, 'list')
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        try {
            const { format = 'csv', fields: fieldsParam, search, ...filters } = req.query
            const listView = collection.views?.list

            // Build where clause (reuse advanced filters)
            const allowedFilters = listView?.filters || []
            const where: any = parseAdvancedFilters(filters, allowedFilters)

            // Build search clause
            if (search && listView?.search && listView.search.length > 0) {
                where[Op.or] = listView.search.map((field: string) => ({
                    [field]: { [Op.iLike]: `%${search}%` }
                }))
            }

            // Determine fields to export (exclude secure fields)
            const secureFieldNames = new Set(
                (collection.fields || []).filter(f => f.secure).map(f => f.name)
            )
            let exportFields: string[] | undefined
            if (fieldsParam) {
                exportFields = String(fieldsParam).split(',')
                    .map(f => f.trim())
                    .filter(f => !secureFieldNames.has(f))
            } else {
                exportFields = (collection.fields || [])
                    .filter(f => !f.secure && f.type !== 'hasMany' && f.type !== 'belongsToMany')
                    .map(f => f.name)
            }

            const MAX_EXPORT_ROWS = 10000
            const rows = await collection.model.findAll({
                where,
                attributes: exportFields,
                limit: MAX_EXPORT_ROWS,
                order: [['id', 'ASC']],
                raw: true
            })

            if (format === 'json') {
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Content-Disposition', `attachment; filename="${collectionName}_export.json"`)
                return res.send(JSON.stringify(rows, null, 2))
            }

            // CSV format
            if (!exportFields || exportFields.length === 0) {
                exportFields = rows.length > 0 ? Object.keys(rows[0]) : []
            }

            const csvLines: string[] = []
            csvLines.push(exportFields.map(escapeCsvValue).join(','))
            for (const row of rows) {
                csvLines.push(exportFields.map(field => escapeCsvValue((row as any)[field])).join(','))
            }

            res.setHeader('Content-Type', 'text/csv; charset=utf-8')
            res.setHeader('Content-Disposition', `attachment; filename="${collectionName}_export.csv"`)
            return res.send(csvLines.join('\n'))
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] Export error for ${collectionName}:`, err)
            return (res as any).error?.({ status: 400, errors: [err.message] })
        }
    }

    /**
     * POST /admin/collections/:collection/bulk
     * Bulk operations on collection records
     */
    @Post('/admin/collections/:collection/bulk')
    @ShouldBeAuthenticated()
    async bulk(
        req: Request & { user: any; params: { collection: string }; body: any },
        res: Response
    ): Promise<any> {
        const { collection: collectionName } = req.params
        const adminLeaf = getAdminLeaf()

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        const { action, ids, data } = req.body

        if (!action || !ids || !Array.isArray(ids)) {
            return (res as any).error?.({ status: 400, errors: ['action_and_ids_required'] })
        }

        if (ids.length > 100) {
            return (res as any).error?.({ status: 400, errors: ['max_100_ids_per_request'] })
        }

        // Check appropriate access
        const requiredAccess = action === 'delete' ? 'delete' : 'update'
        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, requiredAccess)
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        try {
            const resolvedHooks = adminLeaf.getResolvedHooks(collectionName)

            if (action === 'delete') {
                // If hooks are defined, run them per-record
                if (resolvedHooks?.beforeDelete || resolvedHooks?.afterDelete) {
                    const records = await collection.model.findAll({ where: { id: { [Op.in]: ids } } })
                    let deleted = 0
                    for (const record of records) {
                        if (resolvedHooks?.beforeDelete) {
                            const canDelete = await resolvedHooks.beforeDelete(record, req)
                            if (canDelete === false) continue
                        }
                        await record.destroy()
                        if (resolvedHooks?.afterDelete) {
                            await resolvedHooks.afterDelete(record, req)
                        }
                        deleted++
                    }
                    return (res as any).success?.({ status: 200, data: { deleted } })
                } else {
                    const deleted = await collection.model.destroy({ where: { id: { [Op.in]: ids } } })
                    return (res as any).success?.({ status: 200, data: { deleted } })
                }
            }

            if (action === 'update') {
                if (!data || typeof data !== 'object') {
                    return (res as any).error?.({ status: 400, errors: ['data_required_for_update'] })
                }
                const [updated] = await collection.model.update(data, { where: { id: { [Op.in]: ids } } })
                return (res as any).success?.({ status: 200, data: { updated } })
            }

            return (res as any).error?.({ status: 400, errors: ['invalid_action'] })
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] Bulk error for ${collectionName}:`, err)
            return (res as any).error?.({ status: 400, errors: [err.message] })
        }
    }

    /**
     * POST /admin/collections/:collection/:id/duplicate
     * Duplicate a record
     */
    @Post('/admin/collections/:collection/:id(\\d+)/duplicate')
    @ShouldBeAuthenticated()
    async duplicate(
        req: Request & { user: any; params: { collection: string; id: string } },
        res: Response
    ): Promise<any> {
        const { collection: collectionName, id } = req.params
        const adminLeaf = getAdminLeaf()

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, 'create')
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        try {
            const record = await collection.model.findByPk(id)
            if (!record) {
                return (res as any).error?.({ status: 404, errors: ['not_found'] })
            }

            const data = record.toJSON ? record.toJSON() : { ...record }
            // Strip auto-generated fields
            delete data.id
            delete data.created_at
            delete data.updated_at
            delete data.deleted_at
            delete data.createdAt
            delete data.updatedAt
            delete data.deletedAt

            const newRecord = await collection.model.create(data)

            return (res as any).success?.({ status: 201, data: newRecord })
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] Duplicate error for ${collectionName}:`, err)
            return (res as any).error?.({ status: 400, errors: [err.message] })
        }
    }

    /**
     * POST /admin/collections/:collection/:id/restore
     * Restore a soft-deleted record
     */
    @Post('/admin/collections/:collection/:id(\\d+)/restore')
    @ShouldBeAuthenticated()
    async restore(
        req: Request & { user: any; params: { collection: string; id: string } },
        res: Response
    ): Promise<any> {
        const { collection: collectionName, id } = req.params
        const adminLeaf = getAdminLeaf()

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        if (!collection.softDelete?.enabled) {
            return (res as any).error?.({ status: 400, errors: ['soft_delete_not_enabled'] })
        }

        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, 'update')
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        try {
            const record = await collection.model.findByPk(id, { paranoid: false })
            if (!record) {
                return (res as any).error?.({ status: 404, errors: ['not_found'] })
            }

            if (typeof record.restore !== 'function') {
                return (res as any).error?.({ status: 400, errors: ['model_does_not_support_restore'] })
            }

            await record.restore()

            return (res as any).success?.({ status: 200, data: record })
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] Restore error for ${collectionName}:`, err)
            return (res as any).error?.({ status: 400, errors: [err.message] })
        }
    }

    /**
     * GET /admin/collections/:collection/stats
     * Get stats for a collection
     *
     * Query params:
     * - stat: stat name (optional, returns all if not specified)
     * - from: start date ISO string (optional)
     * - to: end date ISO string (optional)
     * - granularity: 'day' | 'week' | 'month' (default: 'day', for timeline stats)
     */
    @Get('/admin/collections/:collection/stats')
    @ShouldBeAuthenticated()
    async stats(
        req: Request & { user: any; params: { collection: string }; query: any },
        res: Response
    ): Promise<any> {
        const { collection: collectionName } = req.params
        const { stat: statName, from, to, granularity = 'day' } = req.query
        const adminLeaf = getAdminLeaf()

        const collection = adminLeaf?.getCollection(collectionName)
        if (!collection) {
            return (res as any).error?.({ status: 404, errors: ['collection_not_found'] })
        }

        const hasAccess = await adminLeaf?.checkAccess(req.user, collectionName, 'list')
        if (!hasAccess) {
            return (res as any).error?.({ status: 403, errors: ['forbidden'] })
        }

        const collectionStats = collection.stats || []
        if (collectionStats.length === 0) {
            return (res as any).success?.({ status: 200, data: { stats: [] } })
        }

        // Filter to specific stat if requested
        const statsToProcess = statName
            ? collectionStats.filter(s => s.name === statName)
            : collectionStats

        try {
            const results: Record<string, any> = {}

            for (const stat of statsToProcess) {
                results[stat.name] = await this.computeStat(
                    collection.model,
                    stat,
                    { from, to, granularity }
                )
            }

            return (res as any).success?.({ status: 200, data: { stats: results } })
        } catch (err: any) {
            console.error(`[ETHAdminLeaf] Stats error for ${collectionName}:`, err)
            return (res as any).error?.({ status: 400, errors: [err.message] })
        }
    }

    /**
     * Compute a single stat
     */
    private async computeStat(
        model: any,
        stat: CollectionStat,
        options: { from?: string; to?: string; granularity?: string }
    ): Promise<any> {
        const { from, to, granularity = 'day' } = options
        const dateField = stat.dateField || 'created_at'

        // Build where conditions
        const where: any = {}

        // Add stat-specific conditions
        if (stat.where) {
            for (const [key, value] of Object.entries(stat.where)) {
                if (value === '$not_null$') {
                    where[key] = { [Op.ne]: null }
                } else if (value === '$null$') {
                    where[key] = null
                } else {
                    where[key] = value
                }
            }
        }

        // Add date range filter (unless stat is global)
        if ((from || to) && !stat.global) {
            where[dateField] = {}
            if (from) where[dateField][Op.gte] = new Date(from)
            if (to) where[dateField][Op.lte] = new Date(to)
        }

        if (stat.type === 'count') {
            // Simple count
            const count = await model.count({ where })
            return {
                type: 'count',
                label: stat.label,
                icon: stat.icon,
                color: stat.color,
                value: count,
                global: stat.global ?? false
            }
        }

        if (stat.type === 'timeline') {
            // Count grouped by date (PostgreSQL format)
            const dateFormat = granularity === 'month'
                ? 'YYYY-MM'
                : granularity === 'week'
                    ? 'IYYY-IW'  // ISO week
                    : 'YYYY-MM-DD'

            const results = await model.findAll({
                attributes: [
                    [fn('TO_CHAR', col(dateField), dateFormat), 'date'],
                    [fn('COUNT', col('id')), 'count']
                ],
                where,
                group: [fn('TO_CHAR', col(dateField), dateFormat)],
                order: [[fn('TO_CHAR', col(dateField), dateFormat), 'ASC']],
                raw: true
            })

            return {
                type: 'timeline',
                label: stat.label,
                icon: stat.icon,
                color: stat.color,
                granularity,
                data: results.map((r: any) => ({
                    date: r.date,
                    count: parseInt(r.count, 10)
                }))
            }
        }

        return null
    }
}

export const AvailableRouteMethods = [
    'list',
    'search',
    'export',
    'bulk',
    'show',
    'subCollection',
    'showSubCollectionItem',
    'updateSubCollectionItem',
    'deleteSubCollectionItem',
    'executeSubCollectionAction',
    'create',
    'update',
    'delete',
    'duplicate',
    'restore',
    'executeAction',
    'stats'
] as const
