var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Op } from 'sequelize';
const createMethodHandler = (method) => {
    return (path) => {
        return (target, propertyKey) => {
            if (!Reflect.hasMetadata('routes', target.constructor)) {
                Reflect.defineMetadata('routes', [], target.constructor);
            }
            const routes = Reflect.getMetadata('routes', target.constructor);
            routes.push({
                requestMethod: method,
                path,
                methodName: propertyKey,
                middlewares: Reflect.getMetadata('middlewares', target, propertyKey) || [],
            });
            Reflect.defineMetadata('routes', routes, target.constructor);
        };
    };
};
// HTTP Method Decorators
export const Get = createMethodHandler('get');
export const Post = createMethodHandler('post');
export const Put = createMethodHandler('put');
export const Patch = createMethodHandler('patch');
export const Delete = createMethodHandler('delete');
export const Options = createMethodHandler('options');
export const Head = createMethodHandler('head');
export const All = createMethodHandler('all');
// Middleware Decorator
export const Middleware = (cb) => {
    return (target, propertyKey) => {
        if (!Reflect.hasMetadata('routes', target.constructor)) {
            Reflect.defineMetadata('routes', [], target.constructor);
        }
        const middlewares = Reflect.getMetadata('middlewares', target, propertyKey) || [];
        if (Array.isArray(cb)) {
            middlewares.push(...cb);
        }
        else {
            middlewares.push(cb);
        }
        Reflect.defineMetadata('middlewares', middlewares, target, propertyKey);
    };
};
export const Controller = (prefixOrOptions = '') => {
    return (target) => {
        var _a;
        const options = typeof prefixOrOptions === 'string' ? { prefix: prefixOrOptions } : prefixOrOptions;
        Reflect.defineMetadata('prefix', (_a = options.prefix) !== null && _a !== void 0 ? _a : '', target);
        if (options.middlewares) {
            Reflect.defineMetadata('controller_middlewares', options.middlewares, target);
        }
        if (!Reflect.hasMetadata('routes', target)) {
            Reflect.defineMetadata('routes', [], target);
        }
    };
};
/**
 * Decorator to define the response schema for OpenAPI documentation.
 * The schema will be wrapped in `{ status: number, data: <schema> }`.
 *
 * @param schemaOrModel - Either a Sequelize Model class (e.g., User) or an inline schema object
 * @param options - Optional configuration (isArray, description, statusCode)
 *
 * @example Using a Model:
 * ```typescript
 * @Get('/users/me')
 * @OpenAPIResponseSchema(User)
 * getMe(req: Request, res: Response) {
 *     return User.findByPk(req.user.id)
 * }
 *
 * @Get('/users')
 * @OpenAPIResponseSchema(User, { isArray: true })
 * getAll(req: Request, res: Response) {
 *     return User.findAll()
 * }
 * ```
 *
 * @example Using an inline schema object:
 * ```typescript
 * @Get('/stats')
 * @OpenAPIResponseSchema({
 *     totalUsers: { type: 'number' },
 *     activeToday: { type: 'number' },
 *     lastUpdate: { type: 'string', format: 'date-time' }
 * })
 * getStats(req: Request, res: Response) {
 *     return { totalUsers: 100, activeToday: 25, lastUpdate: new Date() }
 * }
 * ```
 */
export const OpenAPIResponseSchema = (schemaOrModel, options = {}) => {
    return (target, propertyKey) => {
        var _a, _b;
        // Determine if it's a Model (has .name) or an inline schema object
        const isModel = typeof schemaOrModel === 'function' && schemaOrModel.name;
        Reflect.defineMetadata('openapi_response_schema', {
            schema: schemaOrModel,
            schemaName: isModel ? schemaOrModel.name : null,
            isInlineSchema: !isModel,
            isArray: (_a = options.isArray) !== null && _a !== void 0 ? _a : false,
            description: options.description,
            statusCode: (_b = options.statusCode) !== null && _b !== void 0 ? _b : 200
        }, target, propertyKey);
    };
};
// Alias for backward compatibility
export const ResponseSchema = OpenAPIResponseSchema;
/**
 * GET / - Find all records with pagination, filtering, and optional search
 */
export const ShouldFindAllFromModel = (model, options) => {
    const { attributes, include = [], defaultLimit = 20, maxLimit = 100, allowedFilters = [], defaultOrder = [], canAccess, whereFn, search, } = options;
    const middlewareDecorator = Middleware((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        try {
            // Check authorization
            if (canAccess) {
                const authorized = yield canAccess(req);
                if (!authorized) {
                    (_a = res.error) === null || _a === void 0 ? void 0 : _a.call(res, { status: 403, errors: [{ message: 'Access denied' }] });
                    return;
                }
            }
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(maxLimit, Math.max(1, Number(req.query.limit) || defaultLimit));
            const offset = (page - 1) * limit;
            // Build where clause from allowed filters
            const where = {};
            for (const filter of allowedFilters) {
                if (req.query[filter] !== undefined) {
                    where[filter] = req.query[filter];
                }
            }
            // Add search conditions if search is enabled and query param is provided
            if (search && search.fields.length > 0) {
                const searchParamName = (_b = search.paramName) !== null && _b !== void 0 ? _b : 'q';
                const searchTerm = req.query[searchParamName];
                if (searchTerm && typeof searchTerm === 'string' && searchTerm.trim() !== '') {
                    // Op is imported at top level
                    const searchConditions = search.fields.map((field) => ({
                        [field]: { [Op.iLike]: `%${searchTerm}%` },
                    }));
                    where[Op.or] = searchConditions;
                }
            }
            // Merge with custom whereFn if provided
            if (whereFn) {
                const customWhere = yield whereFn(req);
                Object.assign(where, customWhere);
            }
            const { rows, count } = yield model.findAndCountAll({
                where,
                attributes,
                include,
                limit,
                offset,
                order: defaultOrder.length > 0 ? defaultOrder : undefined,
            });
            (_c = res.success) === null || _c === void 0 ? void 0 : _c.call(res, { status: 200, data: rows, count });
        }
        catch (err) {
            (_d = res.error) === null || _d === void 0 ? void 0 : _d.call(res, { status: 500, errors: [err.message] });
        }
    }));
    return (target, propertyKey, descriptor) => {
        Reflect.defineMetadata('model_usage', { model, operation: 'findAll', options }, target, propertyKey);
        middlewareDecorator(target, propertyKey, descriptor);
    };
};
/**
 * GET /:id - Find one record by ID
 */
export const ShouldFindOneFromModel = (model, options) => {
    const { paramName, attributes, include = [], canAccess, whereFn } = options;
    const middlewareDecorator = Middleware((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        try {
            const id = req.params[paramName];
            // Build where clause with ID and custom whereFn
            const where = { id };
            if (whereFn) {
                const customWhere = yield whereFn(req);
                Object.assign(where, customWhere);
            }
            const record = yield model.findOne({ where, attributes, include });
            if (!record) {
                (_a = res.error) === null || _a === void 0 ? void 0 : _a.call(res, { status: 404, errors: [{ message: 'Record not found' }] });
                return;
            }
            // Check authorization with record
            if (canAccess) {
                const authorized = yield canAccess(req, record);
                if (!authorized) {
                    (_b = res.error) === null || _b === void 0 ? void 0 : _b.call(res, { status: 403, errors: [{ message: 'Access denied' }] });
                    return;
                }
            }
            (_c = res.success) === null || _c === void 0 ? void 0 : _c.call(res, { status: 200, data: record });
        }
        catch (err) {
            (_d = res.error) === null || _d === void 0 ? void 0 : _d.call(res, { status: 500, errors: [err.message] });
        }
    }));
    return (target, propertyKey, descriptor) => {
        Reflect.defineMetadata('model_usage', { model, operation: 'findOne', options }, target, propertyKey);
        middlewareDecorator(target, propertyKey, descriptor);
    };
};
/**
 * POST / - Create a new record (use @ShouldValidateYupForm decorator for validation)
 */
export const ShouldCreateFromModel = (model, options) => {
    const { canAccess } = options;
    const middlewareDecorator = Middleware((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        try {
            // Check authorization
            if (canAccess) {
                const authorized = yield canAccess(req);
                if (!authorized) {
                    (_a = res.error) === null || _a === void 0 ? void 0 : _a.call(res, { status: 403, errors: [{ message: 'Access denied' }] });
                    return;
                }
            }
            const data = (_b = req.form) !== null && _b !== void 0 ? _b : req.body;
            const record = yield model.create(data);
            (_c = res.success) === null || _c === void 0 ? void 0 : _c.call(res, { status: 201, data: record });
        }
        catch (err) {
            (_d = res.error) === null || _d === void 0 ? void 0 : _d.call(res, { status: 400, errors: (_e = err.errors) !== null && _e !== void 0 ? _e : [err.message] });
        }
    }));
    return (target, propertyKey, descriptor) => {
        Reflect.defineMetadata('model_usage', { model, operation: 'create', options }, target, propertyKey);
        middlewareDecorator(target, propertyKey, descriptor);
    };
};
/**
 * PUT /:id - Update a record by ID (use @ShouldValidateYupForm decorator for validation)
 */
export const ShouldUpdateFromModel = (model, options) => {
    const { paramName, canAccess } = options;
    const middlewareDecorator = Middleware((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        try {
            const id = req.params[paramName];
            const record = yield model.findByPk(id);
            if (!record) {
                (_a = res.error) === null || _a === void 0 ? void 0 : _a.call(res, { status: 404, errors: [{ message: 'Record not found' }] });
                return;
            }
            // Check authorization with record
            if (canAccess) {
                const authorized = yield canAccess(req, record);
                if (!authorized) {
                    (_b = res.error) === null || _b === void 0 ? void 0 : _b.call(res, { status: 403, errors: [{ message: 'Access denied' }] });
                    return;
                }
            }
            const data = (_c = req.form) !== null && _c !== void 0 ? _c : req.body;
            yield record.update(data);
            (_d = res.success) === null || _d === void 0 ? void 0 : _d.call(res, { status: 200, data: record });
        }
        catch (err) {
            (_e = res.error) === null || _e === void 0 ? void 0 : _e.call(res, { status: 400, errors: (_f = err.errors) !== null && _f !== void 0 ? _f : [err.message] });
        }
    }));
    return (target, propertyKey, descriptor) => {
        Reflect.defineMetadata('model_usage', { model, operation: 'update', options }, target, propertyKey);
        middlewareDecorator(target, propertyKey, descriptor);
    };
};
/**
 * DELETE /:id - Delete a record by ID
 */
export const ShouldDeleteFromModel = (model, options) => {
    const { paramName, canAccess } = options;
    const middlewareDecorator = Middleware((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        try {
            const id = req.params[paramName];
            const record = yield model.findByPk(id);
            if (!record) {
                (_a = res.error) === null || _a === void 0 ? void 0 : _a.call(res, { status: 404, errors: [{ message: 'Record not found' }] });
                return;
            }
            // Check authorization with record
            if (canAccess) {
                const authorized = yield canAccess(req, record);
                if (!authorized) {
                    (_b = res.error) === null || _b === void 0 ? void 0 : _b.call(res, { status: 403, errors: [{ message: 'Access denied' }] });
                    return;
                }
            }
            yield record.destroy();
            (_c = res.success) === null || _c === void 0 ? void 0 : _c.call(res, { status: 200, data: { deleted: true, id } });
        }
        catch (err) {
            (_d = res.error) === null || _d === void 0 ? void 0 : _d.call(res, { status: 500, errors: [err.message] });
        }
    }));
    return (target, propertyKey, descriptor) => {
        Reflect.defineMetadata('model_usage', { model, operation: 'delete', options }, target, propertyKey);
        middlewareDecorator(target, propertyKey, descriptor);
    };
};
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
export const ShouldSearchInModel = (model, options) => {
    const { paramName, fields, attributes, include = [], defaultLimit = 20, maxLimit = 100, canAccess, whereFn, } = options;
    return Middleware((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        try {
            // Check authorization
            if (canAccess) {
                const authorized = yield canAccess(req);
                if (!authorized) {
                    (_a = res.error) === null || _a === void 0 ? void 0 : _a.call(res, { status: 403, errors: [{ message: 'Access denied' }] });
                    return;
                }
            }
            const searchTerm = req.query[paramName];
            if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') {
                (_b = res.error) === null || _b === void 0 ? void 0 : _b.call(res, { status: 400, errors: [{ message: `Query parameter "${paramName}" is required` }] });
                return;
            }
            const page = Math.max(1, Number(req.query.page) || 1);
            const limit = Math.min(maxLimit, Math.max(1, Number(req.query.limit) || defaultLimit));
            const offset = (page - 1) * limit;
            // Build OR conditions for each field
            // Op is imported at top level
            const searchConditions = fields.map((field) => ({
                [field]: { [Op.iLike]: `%${searchTerm}%` },
            }));
            // Build where with search conditions and custom whereFn
            // Build where with search conditions and custom whereFn
            const where = { [Op.or]: searchConditions };
            if (whereFn) {
                const customWhere = yield whereFn(req);
                Object.assign(where, customWhere);
            }
            const { rows, count } = yield model.findAndCountAll({
                where,
                attributes,
                include,
                limit,
                offset,
            });
            (_c = res.success) === null || _c === void 0 ? void 0 : _c.call(res, {
                status: 200,
                data: rows,
                count,
                message: `Found ${count} results for "${searchTerm}"`,
            });
        }
        catch (err) {
            (_d = res.error) === null || _d === void 0 ? void 0 : _d.call(res, { status: 500, errors: [err.message] });
        }
    }));
};
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
export const ShouldToggleInModel = (model, options) => {
    const { paramName, field, attributes, include = [], canAccess } = options;
    return Middleware((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e;
        try {
            const id = req.params[paramName];
            const record = yield model.findByPk(id, { include });
            if (!record) {
                (_a = res.error) === null || _a === void 0 ? void 0 : _a.call(res, { status: 404, errors: [{ message: 'Record not found' }] });
                return;
            }
            // Check authorization with record
            if (canAccess) {
                const authorized = yield canAccess(req, record);
                if (!authorized) {
                    (_b = res.error) === null || _b === void 0 ? void 0 : _b.call(res, { status: 403, errors: [{ message: 'Access denied' }] });
                    return;
                }
            }
            // Toggle the boolean field
            const currentValue = record[field];
            if (typeof currentValue !== 'boolean') {
                (_c = res.error) === null || _c === void 0 ? void 0 : _c.call(res, { status: 400, errors: [{ message: `Field "${field}" is not a boolean` }] });
                return;
            }
            yield record.update({ [field]: !currentValue });
            // Reload with attributes if specified
            if (attributes) {
                yield record.reload({ attributes, include });
            }
            (_d = res.success) === null || _d === void 0 ? void 0 : _d.call(res, {
                status: 200,
                data: record,
                message: `${field} toggled from ${currentValue} to ${!currentValue}`,
            });
        }
        catch (err) {
            (_e = res.error) === null || _e === void 0 ? void 0 : _e.call(res, { status: 500, errors: [err.message] });
        }
    }));
};
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
export const ShouldFindByFieldInModel = (model, options) => {
    const { paramName, field, attributes, include = [], canAccess, whereFn } = options;
    return Middleware((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        try {
            const value = req.params[paramName];
            // Build where clause with field and custom whereFn
            const where = { [field]: value };
            if (whereFn) {
                const customWhere = yield whereFn(req);
                Object.assign(where, customWhere);
            }
            const record = yield model.findOne({
                where,
                attributes,
                include,
            });
            if (!record) {
                (_a = res.error) === null || _a === void 0 ? void 0 : _a.call(res, { status: 404, errors: [{ message: 'Record not found' }] });
                return;
            }
            // Check authorization with record
            if (canAccess) {
                const authorized = yield canAccess(req, record);
                if (!authorized) {
                    (_b = res.error) === null || _b === void 0 ? void 0 : _b.call(res, { status: 403, errors: [{ message: 'Access denied' }] });
                    return;
                }
            }
            (_c = res.success) === null || _c === void 0 ? void 0 : _c.call(res, { status: 200, data: record });
        }
        catch (err) {
            (_d = res.error) === null || _d === void 0 ? void 0 : _d.call(res, { status: 500, errors: [err.message] });
        }
    }));
};
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
export const ShouldUpdateFieldInModel = (model, options) => {
    const { paramName, field, allowedValues, attributes, include = [], canAccess } = options;
    return Middleware((req, res) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        try {
            const id = req.params[paramName];
            const newValue = req.body[field];
            // Check if value is provided
            if (newValue === undefined) {
                (_a = res.error) === null || _a === void 0 ? void 0 : _a.call(res, { status: 400, errors: [{ message: `Field "${field}" is required in body` }] });
                return;
            }
            // Validate against allowed values if specified
            if (allowedValues && !allowedValues.includes(newValue)) {
                (_b = res.error) === null || _b === void 0 ? void 0 : _b.call(res, {
                    status: 400,
                    errors: [{ message: `Invalid value for "${field}". Allowed: ${allowedValues.join(', ')}` }],
                });
                return;
            }
            const record = yield model.findByPk(id, { include });
            if (!record) {
                (_c = res.error) === null || _c === void 0 ? void 0 : _c.call(res, { status: 404, errors: [{ message: 'Record not found' }] });
                return;
            }
            // Check authorization with record
            if (canAccess) {
                const authorized = yield canAccess(req, record);
                if (!authorized) {
                    (_d = res.error) === null || _d === void 0 ? void 0 : _d.call(res, { status: 403, errors: [{ message: 'Access denied' }] });
                    return;
                }
            }
            const oldValue = record[field];
            yield record.update({ [field]: newValue });
            // Reload with attributes if specified
            if (attributes) {
                yield record.reload({ attributes, include });
            }
            (_e = res.success) === null || _e === void 0 ? void 0 : _e.call(res, {
                status: 200,
                data: record,
                message: `${field} updated from "${oldValue}" to "${newValue}"`,
            });
        }
        catch (err) {
            (_f = res.error) === null || _f === void 0 ? void 0 : _f.call(res, { status: 500, errors: [err.message] });
        }
    }));
};
// Aliases
export const ShouldUseRoute = Middleware;
