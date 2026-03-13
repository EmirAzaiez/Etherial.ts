export interface OpenAPISpec {
    openapi: '3.0.0';
    info: {
        title: string;
        version: string;
        description?: string;
    };
    paths: Record<string, PathItem>;
    components: {
        schemas: Record<string, SchemaObject>;
        securitySchemes?: Record<string, SecurityScheme>;
    };
    tags?: {
        name: string;
        description?: string;
    }[];
}
export interface PathItem {
    get?: OperationObject;
    post?: OperationObject;
    put?: OperationObject;
    delete?: OperationObject;
    patch?: OperationObject;
    options?: OperationObject;
    head?: OperationObject;
}
export interface OperationObject {
    summary?: string;
    description?: string;
    tags?: string[];
    operationId?: string;
    parameters?: ParameterObject[];
    requestBody?: RequestBodyObject;
    responses: Record<string, ResponseObject>;
    security?: SecurityRequirement[];
}
export interface ParameterObject {
    name: string;
    in: 'path' | 'query' | 'header' | 'cookie';
    required?: boolean;
    description?: string;
    schema: SchemaObject;
}
export interface RequestBodyObject {
    required?: boolean;
    content: {
        'application/json'?: {
            schema: SchemaObject;
        };
    };
}
export interface ResponseObject {
    description: string;
    content?: {
        'application/json'?: {
            schema: SchemaObject;
        };
    };
}
export interface SchemaObject {
    type?: string;
    format?: string;
    properties?: Record<string, SchemaObject>;
    items?: SchemaObject;
    required?: string[];
    $ref?: string;
    enum?: any[];
    example?: any;
}
export interface SecurityScheme {
    type: 'http' | 'apiKey' | 'oauth2' | 'openIdConnect';
    scheme?: string;
    bearerFormat?: string;
    name?: string;
    in?: string;
}
export interface SecurityRequirement {
    [name: string]: string[];
}
export interface AnalyzedRoute {
    path: string;
    method: string;
    methodName: string;
    controllerName: string;
    prefix: string;
    yupSchema?: AnalyzedYupSchema;
    yupSchemaLocation?: 'body' | 'query' | 'params';
    modelUsage?: {
        modelName: string;
        operation: 'findAll' | 'findOne' | 'create' | 'update' | 'delete' | 'search' | 'toggle' | 'findByField' | 'updateField';
        options?: Record<string, any>;
    };
    hasAuth: boolean;
    authDescription?: string;
    middlewares: string[];
}
export interface AnalyzedYupSchema {
    type: string;
    fields?: Record<string, AnalyzedYupField>;
    required?: string[];
}
export interface AnalyzedYupField {
    type: string;
    required?: boolean;
    tests?: string[];
    example?: any;
}
export interface AnalyzedModel {
    name: string;
    tableName?: string;
    columns: AnalyzedColumn[];
}
export interface AnalyzedColumn {
    name: string;
    type: string;
    allowNull: boolean;
    primaryKey?: boolean;
    autoIncrement?: boolean;
    defaultValue?: any;
}
export declare class OpenAPIStaticAnalyzer {
    private project;
    constructor();
    /**
     * Analyze a project and generate OpenAPI spec
     */
    analyzeProject(projectPath: string, options?: {
        routesPaths?: string[];
        modelsPaths?: string[];
        formsPaths?: string[];
        leafPaths?: string[];
        projectName?: string;
    }): Promise<OpenAPISpec>;
    /**
     * Detect installed Leafs in the project
     */
    detectInstalledLeafs(projectPath: string): string[];
    /**
     * Analyze route files
     */
    analyzeRoutes(routesPaths: string[]): Promise<AnalyzedRoute[]>;
    /**
     * Extract routes from a source file
     */
    private extractRoutesFromFile;
    /**
     * Extract model usage from decorators
     */
    private extractModelUsage;
    /**
     * Check if method has auth middleware
     */
    private hasAuthMiddleware;
    /**
     * Extract middleware names
     */
    private extractMiddlewares;
    /**
     * Analyze Sequelize models
     */
    analyzeModels(modelsPaths: string[]): Promise<AnalyzedModel[]>;
    /**
     * Extract models from a source file
     */
    private extractModelsFromFile;
    /**
     * Analyze Yup schemas
     */
    analyzeYupSchemas(formsPaths: string[]): Promise<Record<string, AnalyzedYupSchema>>;
    /**
     * Extract Yup schemas from a source file
     */
    private extractYupSchemasFromFile;
    /**
     * Parse a Yup object schema from text
     */
    private parseYupObjectSchema;
    /**
     * Generate OpenAPI spec from analyzed data
     */
    generateOpenAPISpec(routes: AnalyzedRoute[], models: AnalyzedModel[], yupSchemas: Record<string, AnalyzedYupSchema>, info: {
        title: string;
        version: string;
        description?: string;
    }): OpenAPISpec;
    /**
     * Build response schema based on model usage
     */
    private buildResponseSchema;
    /**
     * Convert model to OpenAPI schema
     */
    private modelToSchema;
    /**
     * Convert Yup schema to OpenAPI schema
     */
    private yupSchemaToOpenAPI;
    private getDecoratorStringArg;
    private normalizePath;
    private mapTsTypeToOpenAPI;
    private mapYupTypeToOpenAPI;
}
export declare function createOpenAPIAnalyzer(): OpenAPIStaticAnalyzer;
