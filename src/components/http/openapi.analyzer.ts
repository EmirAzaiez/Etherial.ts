import { Project, Node, SyntaxKind, SourceFile } from 'ts-morph'
import path from 'path'
import fs from 'fs'

// ============================================
// OpenAPI Types
// ============================================

export interface OpenAPISpec {
    openapi: '3.0.0'
    info: {
        title: string
        version: string
        description?: string
    }
    paths: Record<string, PathItem>
    components: {
        schemas: Record<string, SchemaObject>
        securitySchemes?: Record<string, SecurityScheme>
    }
    tags?: { name: string; description?: string }[]
}

export interface PathItem {
    get?: OperationObject
    post?: OperationObject
    put?: OperationObject
    delete?: OperationObject
    patch?: OperationObject
    options?: OperationObject
    head?: OperationObject
}

export interface OperationObject {
    summary?: string
    description?: string
    tags?: string[]
    operationId?: string
    parameters?: ParameterObject[]
    requestBody?: RequestBodyObject
    responses: Record<string, ResponseObject>
    security?: SecurityRequirement[]
}

export interface ParameterObject {
    name: string
    in: 'path' | 'query' | 'header' | 'cookie'
    required?: boolean
    description?: string
    schema: SchemaObject
}

export interface RequestBodyObject {
    required?: boolean
    content: {
        'application/json'?: {
            schema: SchemaObject
        }
    }
}

export interface ResponseObject {
    description: string
    content?: {
        'application/json'?: {
            schema: SchemaObject
        }
    }
}

export interface SchemaObject {
    type?: string
    format?: string
    properties?: Record<string, SchemaObject>
    items?: SchemaObject
    required?: string[]
    $ref?: string
    enum?: any[]
    example?: any
}

export interface SecurityScheme {
    type: 'http' | 'apiKey' | 'oauth2' | 'openIdConnect'
    scheme?: string
    bearerFormat?: string
    name?: string
    in?: string
}

export interface SecurityRequirement {
    [name: string]: string[]
}

// ============================================
// Route Analysis Types
// ============================================

export interface AnalyzedRoute {
    path: string
    method: string
    methodName: string
    controllerName: string
    prefix: string
    yupSchema?: AnalyzedYupSchema
    yupSchemaLocation?: 'body' | 'query' | 'params'
    modelUsage?: {
        modelName: string
        operation: 'findAll' | 'findOne' | 'create' | 'update' | 'delete' | 'search' | 'toggle' | 'findByField' | 'updateField'
        options?: Record<string, any>
    }
    hasAuth: boolean
    authDescription?: string
    middlewares: string[]
}

export interface AnalyzedYupSchema {
    type: string
    fields?: Record<string, AnalyzedYupField>
    required?: string[]
}

export interface AnalyzedYupField {
    type: string
    required?: boolean
    tests?: string[]
    example?: any
}

export interface AnalyzedModel {
    name: string
    tableName?: string
    columns: AnalyzedColumn[]
}

export interface AnalyzedColumn {
    name: string
    type: string
    allowNull: boolean
    primaryKey?: boolean
    autoIncrement?: boolean
    defaultValue?: any
}

// ============================================
// Static Analyzer Class
// ============================================

export class OpenAPIStaticAnalyzer {
    private project: Project

    constructor() {
        this.project = new Project({
            skipAddingFilesFromTsConfig: true,
        })
    }

    /**
     * Analyze a project and generate OpenAPI spec
     */
    async analyzeProject(projectPath: string, options: {
        routesPaths?: string[]
        modelsPaths?: string[]
        formsPaths?: string[]
        leafPaths?: string[]
        projectName?: string
    } = {}): Promise<OpenAPISpec> {
        const routesPaths = options.routesPaths || [path.join(projectPath, 'src', 'routes')]
        const modelsPaths = options.modelsPaths || [path.join(projectPath, 'src', 'models')]
        const formsPaths = options.formsPaths || [path.join(projectPath, 'src', 'forms')]

        // Detect and add Leaf paths
        const detectedLeafs = options.leafPaths || this.detectInstalledLeafs(projectPath)

        for (const leafPath of detectedLeafs) {
            const leafRoutes = path.join(leafPath, 'routes')
            const leafModels = path.join(leafPath, 'models')
            const leafForms = path.join(leafPath, 'forms')

            if (fs.existsSync(leafRoutes)) routesPaths.push(leafRoutes)
            if (fs.existsSync(leafModels)) modelsPaths.push(leafModels)
            if (fs.existsSync(leafForms)) formsPaths.push(leafForms)
        }

        // Analyze all parts
        const routes = await this.analyzeRoutes(routesPaths)
        const models = await this.analyzeModels(modelsPaths)
        const yupSchemas = await this.analyzeYupSchemas(formsPaths)

        // Generate OpenAPI spec
        return this.generateOpenAPISpec(routes, models, yupSchemas, {
            title: options.projectName || 'Etherial API',
            version: '1.0.0',
        })
    }

    /**
     * Detect installed Leafs in the project
     */
    detectInstalledLeafs(projectPath: string): string[] {
        const leafPaths: string[] = []
        const srcPath = path.join(projectPath, 'src')

        if (!fs.existsSync(srcPath)) return leafPaths

        try {
            const entries = fs.readdirSync(srcPath, { withFileTypes: true })

            for (const entry of entries) {
                if (!entry.isDirectory()) continue

                const dirPath = path.join(srcPath, entry.name)

                // Check if it's a Leaf (has leaf.json or matches ETH*Leaf pattern)
                const hasLeafJson = fs.existsSync(path.join(dirPath, 'leaf.json'))
                const matchesPattern = /^ETH\w+Leaf$/.test(entry.name)

                if (hasLeafJson || matchesPattern) {
                    leafPaths.push(dirPath)
                }
            }
        } catch {
            // Ignore errors
        }

        return leafPaths
    }


    /**
     * Analyze route files
     */
    async analyzeRoutes(routesPaths: string[]): Promise<AnalyzedRoute[]> {
        const routes: AnalyzedRoute[] = []

        for (const routePath of routesPaths) {
            if (!fs.existsSync(routePath)) continue

            const stat = fs.statSync(routePath)
            const files = stat.isDirectory()
                ? fs.readdirSync(routePath)
                    .filter(f => f.endsWith('.ts'))
                    .map(f => path.join(routePath, f))
                : [routePath]

            for (const filePath of files) {
                const sourceFile = this.project.addSourceFileAtPath(filePath)
                const fileRoutes = this.extractRoutesFromFile(sourceFile)
                routes.push(...fileRoutes)
            }
        }

        return routes
    }

    /**
     * Extract routes from a source file
     */
    private extractRoutesFromFile(sourceFile: SourceFile): AnalyzedRoute[] {
        const routes: AnalyzedRoute[] = []

        const classes = sourceFile.getClasses()

        for (const classDecl of classes) {
            // Get @Controller decorator
            const controllerDecorator = classDecl.getDecorator('Controller')
            if (!controllerDecorator) continue

            const prefix = this.getDecoratorStringArg(controllerDecorator) || ''
            const controllerName = classDecl.getName() || 'UnnamedController'

            // Get all methods
            for (const method of classDecl.getMethods()) {
                const methodName = method.getName()

                // Check for HTTP method decorators
                const httpMethods = ['Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head', 'All']

                for (const httpMethod of httpMethods) {
                    const decorator = method.getDecorator(httpMethod)
                    if (!decorator) continue

                    const routePath = this.getDecoratorStringArg(decorator) || '/'
                    const fullPath = this.normalizePath(prefix + routePath)

                    // Extract Yup schema info
                    const yupDecorator = method.getDecorator('ShouldValidateYupForm')
                    let yupSchema: AnalyzedYupSchema | undefined
                    let yupSchemaLocation: 'body' | 'query' | 'params' = 'body'

                    if (yupDecorator) {
                        const args = yupDecorator.getArguments()
                        if (args.length > 0) {
                            const schemaName = args[0].getText()
                            yupSchema = { type: 'object', fields: {} }
                            // Will be resolved later from forms analysis
                        }
                        if (args.length > 1) {
                            const loc = args[1].getText().replace(/['"]/g, '')
                            if (['body', 'query', 'params'].includes(loc)) {
                                yupSchemaLocation = loc as any
                            }
                        }
                    }

                    // Extract model usage info
                    const modelUsage = this.extractModelUsage(method)

                    // Check for auth/middleware
                    const middlewareDecorator = method.getDecorator('Middleware')
                    const hasAuth = this.hasAuthMiddleware(method)
                    const middlewares = this.extractMiddlewares(method)

                    routes.push({
                        path: fullPath,
                        method: httpMethod.toLowerCase(),
                        methodName,
                        controllerName,
                        prefix,
                        yupSchema,
                        yupSchemaLocation,
                        modelUsage,
                        hasAuth,
                        middlewares,
                    })

                    break // Only one HTTP method per method
                }
            }
        }

        return routes
    }

    /**
     * Extract model usage from decorators
     */
    private extractModelUsage(method: any): AnalyzedRoute['modelUsage'] | undefined {
        const modelDecorators = [
            { name: 'ShouldFindAllFromModel', operation: 'findAll' },
            { name: 'ShouldFindOneFromModel', operation: 'findOne' },
            { name: 'ShouldCreateFromModel', operation: 'create' },
            { name: 'ShouldUpdateFromModel', operation: 'update' },
            { name: 'ShouldDeleteFromModel', operation: 'delete' },
            { name: 'ShouldSearchInModel', operation: 'search' },
            { name: 'ShouldToggleInModel', operation: 'toggle' },
            { name: 'ShouldFindByFieldInModel', operation: 'findByField' },
            { name: 'ShouldUpdateFieldInModel', operation: 'updateField' },
        ]

        for (const { name, operation } of modelDecorators) {
            const decorator = method.getDecorator(name)
            if (decorator) {
                const args = decorator.getArguments()
                if (args.length > 0) {
                    const modelName = args[0].getText()
                    return {
                        modelName,
                        operation: operation as any,
                    }
                }
            }
        }

        return undefined
    }

    /**
     * Check if method has auth middleware
     */
    private hasAuthMiddleware(method: any): boolean {
        // Check for canAccess in model decorators
        const modelDecorators = [
            'ShouldFindAllFromModel', 'ShouldFindOneFromModel', 'ShouldCreateFromModel',
            'ShouldUpdateFromModel', 'ShouldDeleteFromModel', 'ShouldSearchInModel',
            'ShouldToggleInModel', 'ShouldFindByFieldInModel', 'ShouldUpdateFieldInModel'
        ]

        for (const decoratorName of modelDecorators) {
            const decorator = method.getDecorator(decoratorName)
            if (decorator) {
                const args = decorator.getArguments()
                if (args.length > 1) {
                    const optionsText = args[1].getText()
                    if (optionsText.includes('canAccess')) {
                        return true
                    }
                }
            }
        }

        // Check for Middleware decorator with auth-like names
        const middlewareDecorator = method.getDecorator('Middleware')
        if (middlewareDecorator) {
            const text = middlewareDecorator.getText()
            if (text.includes('auth') || text.includes('Auth') || text.includes('jwt') || text.includes('JWT')) {
                return true
            }
        }

        return false
    }

    /**
     * Extract middleware names
     */
    private extractMiddlewares(method: any): string[] {
        const middlewares: string[] = []
        const decorator = method.getDecorator('Middleware')
        if (decorator) {
            const args = decorator.getArguments()
            for (const arg of args) {
                middlewares.push(arg.getText())
            }
        }
        return middlewares
    }

    /**
     * Analyze Sequelize models
     */
    async analyzeModels(modelsPaths: string[]): Promise<AnalyzedModel[]> {
        const models: AnalyzedModel[] = []

        for (const modelPath of modelsPaths) {
            if (!fs.existsSync(modelPath)) continue

            const stat = fs.statSync(modelPath)
            const files = stat.isDirectory()
                ? fs.readdirSync(modelPath)
                    .filter(f => f.endsWith('.ts'))
                    .map(f => path.join(modelPath, f))
                : [modelPath]

            for (const filePath of files) {
                const sourceFile = this.project.addSourceFileAtPath(filePath)
                const fileModels = this.extractModelsFromFile(sourceFile)
                models.push(...fileModels)
            }
        }

        return models
    }

    /**
     * Extract models from a source file
     */
    private extractModelsFromFile(sourceFile: SourceFile): AnalyzedModel[] {
        const models: AnalyzedModel[] = []

        const classes = sourceFile.getClasses()

        for (const classDecl of classes) {
            // Check for @Table decorator
            const tableDecorator = classDecl.getDecorator('Table')
            if (!tableDecorator) continue

            const modelName = classDecl.getName() || 'UnnamedModel'
            let tableName: string | undefined

            // Extract tableName from @Table options
            const tableArgs = tableDecorator.getArguments()
            if (tableArgs.length > 0) {
                const optionsText = tableArgs[0].getText()
                const tableNameMatch = optionsText.match(/tableName:\s*['"]([^'"]+)['"]/)
                if (tableNameMatch) {
                    tableName = tableNameMatch[1]
                }
            }

            const columns: AnalyzedColumn[] = []

            // Get all properties with @Column
            for (const prop of classDecl.getProperties()) {
                const columnDecorator = prop.getDecorator('Column')
                if (!columnDecorator) continue

                const columnName = prop.getName()
                const propType = prop.getType().getText()

                // Check decorators for constraints
                const allowNull = !!prop.getDecorator('AllowNull')
                const primaryKey = !!prop.getDecorator('PrimaryKey')
                const autoIncrement = !!prop.getDecorator('AutoIncrement')

                let type = this.mapTsTypeToOpenAPI(propType)

                columns.push({
                    name: columnName,
                    type,
                    allowNull,
                    primaryKey,
                    autoIncrement,
                })
            }

            models.push({
                name: modelName,
                tableName,
                columns,
            })
        }

        return models
    }

    /**
     * Analyze Yup schemas
     */
    async analyzeYupSchemas(formsPaths: string[]): Promise<Record<string, AnalyzedYupSchema>> {
        const schemas: Record<string, AnalyzedYupSchema> = {}

        for (const formPath of formsPaths) {
            if (!fs.existsSync(formPath)) continue

            const stat = fs.statSync(formPath)
            const files = stat.isDirectory()
                ? fs.readdirSync(formPath)
                    .filter(f => f.endsWith('.ts'))
                    .map(f => path.join(formPath, f))
                : [formPath]

            for (const filePath of files) {
                const sourceFile = this.project.addSourceFileAtPath(filePath)
                const fileSchemas = this.extractYupSchemasFromFile(sourceFile)
                Object.assign(schemas, fileSchemas)
            }
        }

        return schemas
    }

    /**
     * Extract Yup schemas from a source file
     */
    private extractYupSchemasFromFile(sourceFile: SourceFile): Record<string, AnalyzedYupSchema> {
        const schemas: Record<string, AnalyzedYupSchema> = {}

        // Look for variable declarations with yup.object()
        const varDeclarations = sourceFile.getVariableDeclarations()

        for (const varDecl of varDeclarations) {
            const name = varDecl.getName()
            const initializer = varDecl.getInitializer()

            if (!initializer) continue

            const initText = initializer.getText()

            // Check if it's a Yup schema (yup.object or object())
            if (initText.includes('.object(') || initText.includes('object({')) {
                const schema = this.parseYupObjectSchema(initText)
                if (schema) {
                    schemas[name] = schema
                }
            }
        }

        return schemas
    }

    /**
     * Parse a Yup object schema from text
     */
    private parseYupObjectSchema(text: string): AnalyzedYupSchema | undefined {
        const schema: AnalyzedYupSchema = {
            type: 'object',
            fields: {},
            required: [],
        }

        // Simple regex-based parser for common patterns
        const fieldPattern = /(\w+):\s*(yup\.)?(string|number|boolean|date|array|mixed)\(\)/g
        let match

        while ((match = fieldPattern.exec(text)) !== null) {
            const fieldName = match[1]
            const fieldType = match[3]

            schema.fields![fieldName] = {
                type: this.mapYupTypeToOpenAPI(fieldType),
            }

            // Check if required
            if (text.includes(`${fieldName}:`) && text.includes('.required(')) {
                schema.required!.push(fieldName)
            }
        }

        return Object.keys(schema.fields!).length > 0 ? schema : undefined
    }

    /**
     * Generate OpenAPI spec from analyzed data
     */
    generateOpenAPISpec(
        routes: AnalyzedRoute[],
        models: AnalyzedModel[],
        yupSchemas: Record<string, AnalyzedYupSchema>,
        info: { title: string; version: string; description?: string }
    ): OpenAPISpec {
        const spec: OpenAPISpec = {
            openapi: '3.0.0',
            info,
            paths: {},
            components: {
                schemas: {},
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                    },
                },
            },
            tags: [],
        }

        // Add model schemas
        for (const model of models) {
            spec.components.schemas[model.name] = this.modelToSchema(model)
        }

        // Add Yup schemas 
        for (const [name, schema] of Object.entries(yupSchemas)) {
            spec.components.schemas[name] = this.yupSchemaToOpenAPI(schema)
        }

        // Group routes by controller
        const controllers = new Set(routes.map(r => r.controllerName))
        for (const controller of controllers) {
            spec.tags!.push({
                name: controller,
                description: `${controller} endpoints`,
            })
        }

        // Build paths
        for (const route of routes) {
            const openApiPath = route.path.replace(/:(\w+)/g, '{$1}')

            if (!spec.paths[openApiPath]) {
                spec.paths[openApiPath] = {}
            }

            const operation: OperationObject = {
                summary: route.methodName,
                tags: [route.controllerName],
                operationId: `${route.controllerName}_${route.methodName}`,
                responses: {
                    '200': {
                        description: 'Success',
                        content: {
                            'application/json': {
                                schema: this.buildResponseSchema(route, models),
                            },
                        },
                    },
                },
            }

            // Add parameters from path
            const pathParams = route.path.match(/:(\w+)/g)
            if (pathParams) {
                operation.parameters = pathParams.map(p => ({
                    name: p.substring(1),
                    in: 'path',
                    required: true,
                    schema: { type: 'string' },
                }))
            }

            // Add request body
            if (['post', 'put', 'patch'].includes(route.method) && route.yupSchema) {
                operation.requestBody = {
                    required: true,
                    content: {
                        'application/json': {
                            schema: this.yupSchemaToOpenAPI(route.yupSchema),
                        },
                    },
                }
            }

            // Add security if auth required
            if (route.hasAuth) {
                operation.security = [{ bearerAuth: [] }]
            }

            // Add error responses
            operation.responses['400'] = { description: 'Bad Request' }
            operation.responses['401'] = { description: 'Unauthorized' }
            operation.responses['404'] = { description: 'Not Found' }
            operation.responses['500'] = { description: 'Internal Server Error' }

            spec.paths[openApiPath][route.method as keyof PathItem] = operation
        }

        return spec
    }

    /**
     * Build response schema based on model usage
     */
    private buildResponseSchema(route: AnalyzedRoute, models: AnalyzedModel[]): SchemaObject {
        const modelName = route.modelUsage?.modelName

        if (!modelName) {
            return {
                type: 'object',
                properties: {
                    status: { type: 'number', example: 200 },
                    data: { type: 'object' },
                },
            }
        }

        const isList = ['findAll', 'search'].includes(route.modelUsage?.operation || '')

        if (isList) {
            return {
                type: 'object',
                properties: {
                    status: { type: 'number', example: 200 },
                    data: {
                        type: 'array',
                        items: { $ref: `#/components/schemas/${modelName}` },
                    },
                    count: { type: 'number' },
                },
            }
        }

        return {
            type: 'object',
            properties: {
                status: { type: 'number', example: 200 },
                data: { $ref: `#/components/schemas/${modelName}` },
            },
        }
    }

    /**
     * Convert model to OpenAPI schema
     */
    private modelToSchema(model: AnalyzedModel): SchemaObject {
        const properties: Record<string, SchemaObject> = {}
        const required: string[] = []

        for (const column of model.columns) {
            properties[column.name] = {
                type: column.type,
            }

            if (!column.allowNull && !column.autoIncrement) {
                required.push(column.name)
            }
        }

        return {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined,
        }
    }

    /**
     * Convert Yup schema to OpenAPI schema
     */
    private yupSchemaToOpenAPI(schema: AnalyzedYupSchema): SchemaObject {
        if (schema.type === 'object' && schema.fields) {
            const properties: Record<string, SchemaObject> = {}

            for (const [name, field] of Object.entries(schema.fields)) {
                properties[name] = { type: field.type }
            }

            return {
                type: 'object',
                properties,
                required: schema.required,
            }
        }

        return { type: schema.type }
    }

    // ============================================
    // Helper Methods
    // ============================================

    private getDecoratorStringArg(decorator: any): string | undefined {
        const args = decorator.getArguments()
        if (args.length === 0) return undefined

        const firstArg = args[0]
        const text = firstArg.getText()

        // Handle object argument
        if (text.startsWith('{')) {
            const prefixMatch = text.match(/prefix:\s*['"]([^'"]+)['"]/)
            return prefixMatch ? prefixMatch[1] : undefined
        }

        // Handle string argument
        return text.replace(/['"]/g, '')
    }

    private normalizePath(path: string): string {
        return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/'
    }

    private mapTsTypeToOpenAPI(tsType: string): string {
        const typeMap: Record<string, string> = {
            'string': 'string',
            'number': 'number',
            'boolean': 'boolean',
            'Date': 'string',
            'any': 'object',
        }
        return typeMap[tsType] || 'string'
    }

    private mapYupTypeToOpenAPI(yupType: string): string {
        const typeMap: Record<string, string> = {
            'string': 'string',
            'number': 'number',
            'boolean': 'boolean',
            'date': 'string',
            'array': 'array',
            'mixed': 'object',
        }
        return typeMap[yupType] || 'string'
    }
}

// ============================================
// Factory Function
// ============================================

export function createOpenAPIAnalyzer(): OpenAPIStaticAnalyzer {
    return new OpenAPIStaticAnalyzer()
}
