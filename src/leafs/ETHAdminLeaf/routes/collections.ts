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
import { ActionContext, FieldDefinition, FieldHasMany, FieldBelongsToMany } from '../features/ActionRegistry.js'
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
 * Process belongsToMany relations after parent record is created/updated
 * Syncs the junction table with the provided IDs
 */
async function processBelongsToManyItems(
    record: any,
    fieldName: string,
    _config: FieldBelongsToMany, // For future pivot fields support
    itemIds: number[] | undefined
): Promise<{ added: number; removed: number }> {
    const stats = { added: 0, removed: 0 }

    if (!itemIds || !Array.isArray(itemIds)) {
        return stats
    }

    try {
        // Use Sequelize's set method for the association
        // This automatically handles the junction table
        const setMethodName = `set${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`

        if (typeof record[setMethodName] === 'function') {
            // Get current associations to calculate stats
            const getMethodName = `get${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`
            const currentItems: any[] = typeof record[getMethodName] === 'function'
                ? await record[getMethodName]()
                : []
            const currentIds = new Set<number>(currentItems.map((item: any) => item.id))

            // Set new associations
            await record[setMethodName](itemIds)

            // Calculate stats
            const newIds = new Set<number>(itemIds)
            for (const id of itemIds) {
                if (!currentIds.has(id)) stats.added++
            }
            for (const id of currentIds) {
                if (!newIds.has(id as number)) stats.removed++
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
    }

    // If no transformations needed, return items as-is
    if (Object.keys(optionsMap).length === 0 && secureFields.size === 0) {
        return items
    }

    // Transform each item
    return items.map(item => {
        const json = item.toJSON ? item.toJSON() : { ...item }

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
            const { limit = 25, offset = 0, sort, order, search, ...filters } = req.query
            const listView = collection.views?.list

            // Build where clause from filters
            const where: any = {}
            const allowedFilters = listView?.filters || []
            for (const [key, value] of Object.entries(filters)) {
                if (allowedFilters.includes(key) && value !== undefined && value !== '') {
                    where[key] = value
                }
            }

            // Build search clause
            if (search && listView?.search && listView.search.length > 0) {
                const { Op } = require('sequelize')
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

            const result = await collection.model.findAndCountAll({
                where,
                attributes: listView?.fields,
                include: listView?.include || [],
                order: orderClause,
                limit: Number(limit),
                offset: Number(offset)
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
        req: Request & { user: any; params: { collection: string; id: string } },
        res: Response
    ): Promise<any> {
        const { collection: collectionName, id } = req.params
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

            const items = await subConfig.model.findAndCountAll({
                where: { [subConfig.foreignKey]: id },
                include: nestedIncludes,
                order,
                limit: Number(limit),
                offset: Number(offset)
            })

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
            const belongsToManyData: Map<string, number[]> = new Map()

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
            const belongsToManyData: Map<string, number[]> = new Map()

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
    'show',
    'subCollection',
    'showSubCollectionItem',
    'updateSubCollectionItem',
    'deleteSubCollectionItem',
    'executeSubCollectionAction',
    'create',
    'update',
    'delete',
    'executeAction',
    'stats'
] as const
