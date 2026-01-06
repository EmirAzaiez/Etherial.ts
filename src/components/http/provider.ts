import express from 'express'

export type HttpMethod = 'get' | 'post' | 'delete' | 'options' | 'put' | 'patch' | 'head' | 'all'

export interface RouteDefinition {
    path: string
    requestMethod: HttpMethod
    methodName: string
    middlewares: express.RequestHandler[]
}

export interface NextFunction extends express.NextFunction { }

export interface Request extends express.Request {
    params: Record<string, string>
    body: Record<string, any>
    form?: Record<string, any>
    query: {
        sort?: number
        limit?: number
        offset?: number
        page?: number
        [key: string]: any
    }
    t?: (key: string, params?: Record<string, any> | (string | number)[]) => string
    /** Current request language (available if Translation module is loaded) */
    language?: string
}

export interface Response extends express.Response {
    success?: (json: { status: number; data: any; count?: number; message?: string }) => void
    error?: (json: { status: number; errors: any[]; message?: string }) => void
    // render?: (file: string, data: Record<string, any>) => void
}

type MethodDecorator = (
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>
) => void

const createMethodHandler = (method: HttpMethod) => {
    return (path: string): MethodDecorator => {
        return (target, propertyKey: string): void => {
            if (!Reflect.hasMetadata('routes', target.constructor)) {
                Reflect.defineMetadata('routes', [], target.constructor)
            }

            const routes = Reflect.getMetadata('routes', target.constructor) as RouteDefinition[]

            routes.push({
                requestMethod: method,
                path,
                methodName: propertyKey,
                middlewares: Reflect.getMetadata('middlewares', target, propertyKey) || [],
            })

            Reflect.defineMetadata('routes', routes, target.constructor)
        }
    }
}

// HTTP Method Decorators
export const Get = createMethodHandler('get')
export const Post = createMethodHandler('post')
export const Put = createMethodHandler('put')
export const Patch = createMethodHandler('patch')
export const Delete = createMethodHandler('delete')
export const Options = createMethodHandler('options')
export const Head = createMethodHandler('head')
export const All = createMethodHandler('all')

// Middleware Decorator
export const Middleware = (
    cb: express.RequestHandler | express.RequestHandler[]
): MethodDecorator => {
    return (target, propertyKey: string): void => {
        if (!Reflect.hasMetadata('routes', target.constructor)) {
            Reflect.defineMetadata('routes', [], target.constructor)
        }

        const middlewares: express.RequestHandler[] =
            Reflect.getMetadata('middlewares', target, propertyKey) || []

        if (Array.isArray(cb)) {
            middlewares.push(...cb)
        } else {
            middlewares.push(cb)
        }

        Reflect.defineMetadata('middlewares', middlewares, target, propertyKey)
    }
}

// Controller Decorator
export interface ControllerOptions {
    prefix?: string
    middlewares?: express.RequestHandler[]
}

export const Controller = (prefixOrOptions: string | ControllerOptions = ''): ClassDecorator => {
    return (target: any) => {
        const options: ControllerOptions =
            typeof prefixOrOptions === 'string' ? { prefix: prefixOrOptions } : prefixOrOptions

        Reflect.defineMetadata('prefix', options.prefix ?? '', target)

        if (options.middlewares) {
            Reflect.defineMetadata('controller_middlewares', options.middlewares, target)
        }

        if (!Reflect.hasMetadata('routes', target)) {
            Reflect.defineMetadata('routes', [], target)
        }
    }
}

// ============================================
// CRUD Model Decorators
// ============================================

// Type for user in request (customize based on your auth)
export interface RequestWithUser extends Request {
    user?: any
}

// Authorization function type
export type CanAccessFn = (req: RequestWithUser, record?: any) => boolean | Promise<boolean>

// Custom where function type - allows dynamic where conditions based on request
export type WhereFn = (req: RequestWithUser) => Record<string, any> | Promise<Record<string, any>>

export interface SearchConfig {
    paramName?: string // Query param for search (default: 'q')
    fields: string[] // Fields to search in
}

export interface FindAllOptions {
    paramName: string
    attributes?: string[]
    include?: any[]
    defaultLimit?: number
    maxLimit?: number
    allowedFilters?: string[]
    defaultOrder?: [string, 'ASC' | 'DESC'][]
    canAccess?: CanAccessFn
    whereFn?: WhereFn
    search?: SearchConfig // Enable search on specified fields
}

export interface FindOneOptions {
    paramName: string
    attributes?: string[]
    include?: any[]
    canAccess?: CanAccessFn
    whereFn?: WhereFn
}

export interface CreateOptions {
    paramName: string
    canAccess?: CanAccessFn
}

export interface UpdateOptions {
    paramName: string
    canAccess?: CanAccessFn
}

export interface DeleteOptions {
    paramName: string
    soft?: boolean
    canAccess?: CanAccessFn
}

/**
 * GET / - Find all records with pagination, filtering, and optional search
 */
export const ShouldFindAllFromModel = (model: any, options: FindAllOptions): MethodDecorator => {
    const {
        attributes,
        include = [],
        defaultLimit = 20,
        maxLimit = 100,
        allowedFilters = [],
        defaultOrder = [],
        canAccess,
        whereFn,
        search,
    } = options

    return Middleware(async (req: RequestWithUser, res: Response) => {
        try {
            // Check authorization
            if (canAccess) {
                const authorized = await canAccess(req)
                if (!authorized) {
                    res.error?.({ status: 403, errors: [{ message: 'Access denied' }] })
                    return
                }
            }

            const page = Math.max(1, Number(req.query.page) || 1)
            const limit = Math.min(maxLimit, Math.max(1, Number(req.query.limit) || defaultLimit))
            const offset = (page - 1) * limit

            // Build where clause from allowed filters
            const where: Record<string, any> = {}
            for (const filter of allowedFilters) {
                if (req.query[filter] !== undefined) {
                    where[filter] = req.query[filter]
                }
            }

            // Add search conditions if search is enabled and query param is provided
            if (search && search.fields.length > 0) {
                const searchParamName = search.paramName ?? 'q'
                const searchTerm = req.query[searchParamName]

                if (searchTerm && typeof searchTerm === 'string' && searchTerm.trim() !== '') {
                    const { Op } = require('sequelize')
                    const searchConditions = search.fields.map((field) => ({
                        [field]: { [Op.iLike]: `%${searchTerm}%` },
                    }))
                    where[Op.or] = searchConditions
                }
            }

            // Merge with custom whereFn if provided
            if (whereFn) {
                const customWhere = await whereFn(req)
                Object.assign(where, customWhere)
            }

            const { rows, count } = await model.findAndCountAll({
                where,
                attributes,
                include,
                limit,
                offset,
                order: defaultOrder.length > 0 ? defaultOrder : undefined,
            })

            res.success?.({ status: 200, data: rows, count })
        } catch (err: any) {
            res.error?.({ status: 500, errors: [err.message] })
        }
    })
}

/**
 * GET /:id - Find one record by ID
 */
export const ShouldFindOneFromModel = (model: any, options: FindOneOptions): MethodDecorator => {
    const { paramName, attributes, include = [], canAccess, whereFn } = options

    return Middleware(async (req: RequestWithUser, res: Response) => {
        try {
            const id = req.params[paramName]

            // Build where clause with ID and custom whereFn
            const where: Record<string, any> = { id }
            if (whereFn) {
                const customWhere = await whereFn(req)
                Object.assign(where, customWhere)
            }

            const record = await model.findOne({ where, attributes, include })

            if (!record) {
                res.error?.({ status: 404, errors: [{ message: 'Record not found' }] })
                return
            }

            // Check authorization with record
            if (canAccess) {
                const authorized = await canAccess(req, record)
                if (!authorized) {
                    res.error?.({ status: 403, errors: [{ message: 'Access denied' }] })
                    return
                }
            }

            res.success?.({ status: 200, data: record })
        } catch (err: any) {
            res.error?.({ status: 500, errors: [err.message] })
        }
    })
}

/**
 * POST / - Create a new record (use @ShouldValidateYupForm decorator for validation)
 */
export const ShouldCreateFromModel = (model: any, options: CreateOptions): MethodDecorator => {
    const { canAccess } = options

    return Middleware(async (req: RequestWithUser, res: Response) => {
        try {
            // Check authorization
            if (canAccess) {
                const authorized = await canAccess(req)
                if (!authorized) {
                    res.error?.({ status: 403, errors: [{ message: 'Access denied' }] })
                    return
                }
            }

            const data = req.form ?? req.body
            const record = await model.create(data)
            res.success?.({ status: 201, data: record })
        } catch (err: any) {
            res.error?.({ status: 400, errors: err.errors ?? [err.message] })
        }
    })
}

/**
 * PUT /:id - Update a record by ID (use @ShouldValidateYupForm decorator for validation)
 */
export const ShouldUpdateFromModel = (model: any, options: UpdateOptions): MethodDecorator => {
    const { paramName, canAccess } = options

    return Middleware(async (req: RequestWithUser, res: Response) => {
        try {
            const id = req.params[paramName]
            const record = await model.findByPk(id)

            if (!record) {
                res.error?.({ status: 404, errors: [{ message: 'Record not found' }] })
                return
            }

            // Check authorization with record
            if (canAccess) {
                const authorized = await canAccess(req, record)
                if (!authorized) {
                    res.error?.({ status: 403, errors: [{ message: 'Access denied' }] })
                    return
                }
            }

            const data = req.form ?? req.body
            await record.update(data)
            res.success?.({ status: 200, data: record })
        } catch (err: any) {
            res.error?.({ status: 400, errors: err.errors ?? [err.message] })
        }
    })
}

/**
 * DELETE /:id - Delete a record by ID
 */
export const ShouldDeleteFromModel = (model: any, options: DeleteOptions): MethodDecorator => {
    const { paramName, canAccess } = options

    return Middleware(async (req: RequestWithUser, res: Response) => {
        try {
            const id = req.params[paramName]
            const record = await model.findByPk(id)

            if (!record) {
                res.error?.({ status: 404, errors: [{ message: 'Record not found' }] })
                return
            }

            // Check authorization with record
            if (canAccess) {
                const authorized = await canAccess(req, record)
                if (!authorized) {
                    res.error?.({ status: 403, errors: [{ message: 'Access denied' }] })
                    return
                }
            }

            await record.destroy()
            res.success?.({ status: 200, data: { deleted: true, id } })
        } catch (err: any) {
            res.error?.({ status: 500, errors: [err.message] })
        }
    })
}

// ============================================
// Advanced Model Decorators
// ============================================

export interface SearchOptions {
    paramName: string // Query param name for search (e.g., 'q', 'search')
    fields: string[] // Fields to search in (e.g., ['name', 'description'])
    attributes?: string[]
    include?: any[]
    defaultLimit?: number
    maxLimit?: number
    canAccess?: CanAccessFn
    whereFn?: WhereFn
}

export interface ToggleOptions {
    paramName: string // Route param (e.g., 'id')
    field: string // Boolean field to toggle (e.g., 'isActive')
    attributes?: string[]
    include?: any[]
    canAccess?: CanAccessFn
}

export interface FindByFieldOptions {
    paramName: string // Route param name (e.g., 'slug', 'email')
    field: string // Model field to search by (e.g., 'slug', 'email')
    attributes?: string[]
    include?: any[]
    canAccess?: CanAccessFn
    whereFn?: WhereFn
}

export interface UpdateFieldOptions {
    paramName: string // Route param (e.g., 'id')
    field: string // Field to update (e.g., 'status')
    allowedValues?: any[] // Allowed values for the field (optional validation)
    attributes?: string[]
    include?: any[]
    canAccess?: CanAccessFn
}

/**
 * GET /search?q=... - Full-text search across multiple fields
 * 
 * @example
 * ```typescript
 * @Get('/search')
 * @ShouldSearchInModel(Product, {
 *     paramName: 'q',
 *     fields: ['name', 'description', 'tags'],
 *     attributes: ['id', 'name', 'price'],
 *     include: [Category],
 *     canAccess: (req) => !!req.user,
 * })
 * search() {}
 * ```
 */
export const ShouldSearchInModel = (model: any, options: SearchOptions): MethodDecorator => {
    const {
        paramName,
        fields,
        attributes,
        include = [],
        defaultLimit = 20,
        maxLimit = 100,
        canAccess,
        whereFn,
    } = options

    return Middleware(async (req: RequestWithUser, res: Response) => {
        try {
            // Check authorization
            if (canAccess) {
                const authorized = await canAccess(req)
                if (!authorized) {
                    res.error?.({ status: 403, errors: [{ message: 'Access denied' }] })
                    return
                }
            }

            const searchTerm = req.query[paramName]

            if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') {
                res.error?.({ status: 400, errors: [{ message: `Query parameter "${paramName}" is required` }] })
                return
            }

            const page = Math.max(1, Number(req.query.page) || 1)
            const limit = Math.min(maxLimit, Math.max(1, Number(req.query.limit) || defaultLimit))
            const offset = (page - 1) * limit

            // Build OR conditions for each field
            const { Op } = require('sequelize')
            const searchConditions = fields.map((field) => ({
                [field]: { [Op.iLike]: `%${searchTerm}%` },
            }))

            // Build where with search conditions and custom whereFn
            const where: Record<string, any> = { [Op.or]: searchConditions }
            if (whereFn) {
                const customWhere = await whereFn(req)
                Object.assign(where, customWhere)
            }

            const { rows, count } = await model.findAndCountAll({
                where,
                attributes,
                include,
                limit,
                offset,
            })

            res.success?.({
                status: 200,
                data: rows,
                count,
                message: `Found ${count} results for "${searchTerm}"`,
            })
        } catch (err: any) {
            res.error?.({ status: 500, errors: [err.message] })
        }
    })
}

/**
 * POST /:id/toggle-field - Toggle a boolean field
 * 
 * @example
 * ```typescript
 * @Post('/:id/toggle-active')
 * @ShouldToggleInModel(User, {
 *     paramName: 'id',
 *     field: 'isActive',
 *     attributes: ['id', 'name', 'isActive'],
 *     canAccess: (req) => req.user?.role === 'admin',
 * })
 * toggleActive() {}
 * ```
 */
export const ShouldToggleInModel = (model: any, options: ToggleOptions): MethodDecorator => {
    const { paramName, field, attributes, include = [], canAccess } = options

    return Middleware(async (req: RequestWithUser, res: Response) => {
        try {
            const id = req.params[paramName]
            const record = await model.findByPk(id, { include })

            if (!record) {
                res.error?.({ status: 404, errors: [{ message: 'Record not found' }] })
                return
            }

            // Check authorization with record
            if (canAccess) {
                const authorized = await canAccess(req, record)
                if (!authorized) {
                    res.error?.({ status: 403, errors: [{ message: 'Access denied' }] })
                    return
                }
            }

            // Toggle the boolean field
            const currentValue = record[field]
            if (typeof currentValue !== 'boolean') {
                res.error?.({ status: 400, errors: [{ message: `Field "${field}" is not a boolean` }] })
                return
            }

            await record.update({ [field]: !currentValue })

            // Reload with attributes if specified
            if (attributes) {
                await record.reload({ attributes, include })
            }

            res.success?.({
                status: 200,
                data: record,
                message: `${field} toggled from ${currentValue} to ${!currentValue}`,
            })
        } catch (err: any) {
            res.error?.({ status: 500, errors: [err.message] })
        }
    })
}

/**
 * GET /:field - Find a record by a custom field (not just ID)
 * 
 * @example
 * ```typescript
 * @Get('/by-slug/:slug')
 * @ShouldFindByFieldInModel(Product, {
 *     paramName: 'slug',
 *     field: 'slug',
 *     attributes: ['id', 'name', 'slug', 'price'],
 *     include: [Category, { model: Review, limit: 5 }],
 *     canAccess: (req, record) => record.isPublished || req.user?.role === 'admin',
 * })
 * findBySlug() {}
 * 
 * @Get('/by-email/:email')
 * @ShouldFindByFieldInModel(User, {
 *     paramName: 'email',
 *     field: 'email',
 *     attributes: ['id', 'name', 'email'],
 * })
 * findByEmail() {}
 * ```
 */
export const ShouldFindByFieldInModel = (model: any, options: FindByFieldOptions): MethodDecorator => {
    const { paramName, field, attributes, include = [], canAccess, whereFn } = options

    return Middleware(async (req: RequestWithUser, res: Response) => {
        try {
            const value = req.params[paramName]

            // Build where clause with field and custom whereFn
            const where: Record<string, any> = { [field]: value }
            if (whereFn) {
                const customWhere = await whereFn(req)
                Object.assign(where, customWhere)
            }

            const record = await model.findOne({
                where,
                attributes,
                include,
            })

            if (!record) {
                res.error?.({ status: 404, errors: [{ message: 'Record not found' }] })
                return
            }

            // Check authorization with record
            if (canAccess) {
                const authorized = await canAccess(req, record)
                if (!authorized) {
                    res.error?.({ status: 403, errors: [{ message: 'Access denied' }] })
                    return
                }
            }

            res.success?.({ status: 200, data: record })
        } catch (err: any) {
            res.error?.({ status: 500, errors: [err.message] })
        }
    })
}

/**
 * PATCH /:id/field - Update a single field (e.g., status, role, etc.)
 * 
 * @example
 * ```typescript
 * @Patch('/:id/status')
 * @ShouldUpdateFieldInModel(Order, {
 *     paramName: 'id',
 *     field: 'status',
 *     allowedValues: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
 *     attributes: ['id', 'status', 'updatedAt'],
 *     canAccess: (req) => req.user?.role === 'admin',
 * })
 * updateStatus() {}
 * 
 * @Patch('/:id/role')
 * @ShouldUpdateFieldInModel(User, {
 *     paramName: 'id',
 *     field: 'role',
 *     allowedValues: ['user', 'moderator', 'admin'],
 *     canAccess: (req) => req.user?.role === 'superadmin',
 * })
 * updateRole() {}
 * ```
 */
export const ShouldUpdateFieldInModel = (model: any, options: UpdateFieldOptions): MethodDecorator => {
    const { paramName, field, allowedValues, attributes, include = [], canAccess } = options

    return Middleware(async (req: RequestWithUser, res: Response) => {
        try {
            const id = req.params[paramName]
            const newValue = req.body[field]

            // Check if value is provided
            if (newValue === undefined) {
                res.error?.({ status: 400, errors: [{ message: `Field "${field}" is required in body` }] })
                return
            }

            // Validate against allowed values if specified
            if (allowedValues && !allowedValues.includes(newValue)) {
                res.error?.({
                    status: 400,
                    errors: [{ message: `Invalid value for "${field}". Allowed: ${allowedValues.join(', ')}` }],
                })
                return
            }

            const record = await model.findByPk(id, { include })

            if (!record) {
                res.error?.({ status: 404, errors: [{ message: 'Record not found' }] })
                return
            }

            // Check authorization with record
            if (canAccess) {
                const authorized = await canAccess(req, record)
                if (!authorized) {
                    res.error?.({ status: 403, errors: [{ message: 'Access denied' }] })
                    return
                }
            }

            const oldValue = record[field]
            await record.update({ [field]: newValue })

            // Reload with attributes if specified
            if (attributes) {
                await record.reload({ attributes, include })
            }

            res.success?.({
                status: 200,
                data: record,
                message: `${field} updated from "${oldValue}" to "${newValue}"`,
            })
        } catch (err: any) {
            res.error?.({ status: 500, errors: [err.message] })
        }
    })
}

// ============================================
// CRUD Class Decorator - Auto-generates all routes
// ============================================

export interface CRUDConfig {
    model: any
    paramName: string // REQUIRED - e.g., 'id', 'userId', 'slug'
    findAll?: Omit<FindAllOptions, 'paramName'> | false
    findOne?: Omit<FindOneOptions, 'paramName'> | false
    create?: Omit<CreateOptions, 'paramName'> | false
    update?: Omit<UpdateOptions, 'paramName'> | false
    delete?: Omit<DeleteOptions, 'paramName'> | false
    middlewares?: {
        findAll?: express.RequestHandler[]
        findOne?: express.RequestHandler[]
        create?: express.RequestHandler[]
        update?: express.RequestHandler[]
        delete?: express.RequestHandler[]
    }
}

// Aliases
export const ShouldUseRoute = Middleware

// Utility type for typed route params
export type RouteParams<T extends string> = T extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof RouteParams<Rest>]: string }
    : T extends `${string}:${infer Param}`
    ? { [K in Param]: string }
    : Record<string, never>
