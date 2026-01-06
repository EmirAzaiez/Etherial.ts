import express from 'express';
export type HttpMethod = 'get' | 'post' | 'delete' | 'options' | 'put' | 'patch' | 'head' | 'all';
export interface RouteDefinition {
    path: string;
    requestMethod: HttpMethod;
    methodName: string;
    middlewares: express.RequestHandler[];
}
export interface NextFunction extends express.NextFunction {
}
export interface Request extends express.Request {
    params: Record<string, string>;
    body: Record<string, any>;
    form?: Record<string, any>;
    query: {
        sort?: number;
        limit?: number;
        offset?: number;
        page?: number;
        [key: string]: any;
    };
    t?: (key: string, params?: Record<string, any> | (string | number)[]) => string;
    /** Current request language (available if Translation module is loaded) */
    language?: string;
}
export interface Response extends express.Response {
    success?: (json: {
        status: number;
        data: any;
        count?: number;
        message?: string;
    }) => void;
    error?: (json: {
        status: number;
        errors: any[];
        message?: string;
    }) => void;
}
type MethodDecorator = (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => void;
export declare const Get: (path: string) => MethodDecorator;
export declare const Post: (path: string) => MethodDecorator;
export declare const Put: (path: string) => MethodDecorator;
export declare const Patch: (path: string) => MethodDecorator;
export declare const Delete: (path: string) => MethodDecorator;
export declare const Options: (path: string) => MethodDecorator;
export declare const Head: (path: string) => MethodDecorator;
export declare const All: (path: string) => MethodDecorator;
export declare const Middleware: (cb: express.RequestHandler | express.RequestHandler[]) => MethodDecorator;
export interface ControllerOptions {
    prefix?: string;
    middlewares?: express.RequestHandler[];
}
export declare const Controller: (prefixOrOptions?: string | ControllerOptions) => ClassDecorator;
export interface RequestWithUser extends Request {
    user?: any;
}
export type CanAccessFn = (req: RequestWithUser, record?: any) => boolean | Promise<boolean>;
export type WhereFn = (req: RequestWithUser) => Record<string, any> | Promise<Record<string, any>>;
export interface SearchConfig {
    paramName?: string;
    fields: string[];
}
export interface FindAllOptions {
    paramName: string;
    attributes?: string[];
    include?: any[];
    defaultLimit?: number;
    maxLimit?: number;
    allowedFilters?: string[];
    defaultOrder?: [string, 'ASC' | 'DESC'][];
    canAccess?: CanAccessFn;
    whereFn?: WhereFn;
    search?: SearchConfig;
}
export interface FindOneOptions {
    paramName: string;
    attributes?: string[];
    include?: any[];
    canAccess?: CanAccessFn;
    whereFn?: WhereFn;
}
export interface CreateOptions {
    paramName: string;
    canAccess?: CanAccessFn;
}
export interface UpdateOptions {
    paramName: string;
    canAccess?: CanAccessFn;
}
export interface DeleteOptions {
    paramName: string;
    soft?: boolean;
    canAccess?: CanAccessFn;
}
/**
 * GET / - Find all records with pagination, filtering, and optional search
 */
export declare const ShouldFindAllFromModel: (model: any, options: FindAllOptions) => MethodDecorator;
/**
 * GET /:id - Find one record by ID
 */
export declare const ShouldFindOneFromModel: (model: any, options: FindOneOptions) => MethodDecorator;
/**
 * POST / - Create a new record (use @ShouldValidateYupForm decorator for validation)
 */
export declare const ShouldCreateFromModel: (model: any, options: CreateOptions) => MethodDecorator;
/**
 * PUT /:id - Update a record by ID (use @ShouldValidateYupForm decorator for validation)
 */
export declare const ShouldUpdateFromModel: (model: any, options: UpdateOptions) => MethodDecorator;
/**
 * DELETE /:id - Delete a record by ID
 */
export declare const ShouldDeleteFromModel: (model: any, options: DeleteOptions) => MethodDecorator;
export interface SearchOptions {
    paramName: string;
    fields: string[];
    attributes?: string[];
    include?: any[];
    defaultLimit?: number;
    maxLimit?: number;
    canAccess?: CanAccessFn;
    whereFn?: WhereFn;
}
export interface ToggleOptions {
    paramName: string;
    field: string;
    attributes?: string[];
    include?: any[];
    canAccess?: CanAccessFn;
}
export interface FindByFieldOptions {
    paramName: string;
    field: string;
    attributes?: string[];
    include?: any[];
    canAccess?: CanAccessFn;
    whereFn?: WhereFn;
}
export interface UpdateFieldOptions {
    paramName: string;
    field: string;
    allowedValues?: any[];
    attributes?: string[];
    include?: any[];
    canAccess?: CanAccessFn;
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
export declare const ShouldSearchInModel: (model: any, options: SearchOptions) => MethodDecorator;
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
export declare const ShouldToggleInModel: (model: any, options: ToggleOptions) => MethodDecorator;
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
export declare const ShouldFindByFieldInModel: (model: any, options: FindByFieldOptions) => MethodDecorator;
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
export declare const ShouldUpdateFieldInModel: (model: any, options: UpdateFieldOptions) => MethodDecorator;
export interface CRUDConfig {
    model: any;
    paramName: string;
    findAll?: Omit<FindAllOptions, 'paramName'> | false;
    findOne?: Omit<FindOneOptions, 'paramName'> | false;
    create?: Omit<CreateOptions, 'paramName'> | false;
    update?: Omit<UpdateOptions, 'paramName'> | false;
    delete?: Omit<DeleteOptions, 'paramName'> | false;
    middlewares?: {
        findAll?: express.RequestHandler[];
        findOne?: express.RequestHandler[];
        create?: express.RequestHandler[];
        update?: express.RequestHandler[];
        delete?: express.RequestHandler[];
    };
}
export declare const ShouldUseRoute: (cb: express.RequestHandler | express.RequestHandler[]) => MethodDecorator;
export type RouteParams<T extends string> = T extends `${string}:${infer Param}/${infer Rest}` ? {
    [K in Param | keyof RouteParams<Rest>]: string;
} : T extends `${string}:${infer Param}` ? {
    [K in Param]: string;
} : Record<string, never>;
export {};
