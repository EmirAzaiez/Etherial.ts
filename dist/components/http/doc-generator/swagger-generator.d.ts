export interface OpenAPIInfo {
    title: string;
    description?: string;
    version: string;
    contact?: {
        name?: string;
        email?: string;
        url?: string;
    };
    license?: {
        name: string;
        url?: string;
    };
}
export interface OpenAPIServer {
    url: string;
    description?: string;
}
export interface SwaggerGeneratorConfig {
    info: OpenAPIInfo;
    servers: OpenAPIServer[];
    routesPaths: string[];
    modelsPaths?: string[];
    formsPaths?: string[];
    outputPath?: string;
    securitySchemes?: Record<string, any>;
}
export interface RouteInfo {
    path: string;
    method: 'get' | 'post' | 'put' | 'delete' | 'patch';
    methodName: string;
    controllerName: string;
    prefix: string;
    description?: string;
    summary?: string;
    tags?: string[];
    requiresAuth: boolean;
    formName?: string;
    formFile?: string;
    responseType?: string;
    parameters?: ParameterInfo[];
}
export interface ParameterInfo {
    name: string;
    in: 'path' | 'query' | 'header' | 'cookie';
    required: boolean;
    type: string;
    description?: string;
}
export interface FormFieldInfo {
    name: string;
    type: string;
    required: boolean;
    description?: string;
    validations?: string[];
}
export interface FormInfo {
    name: string;
    fields: FormFieldInfo[];
}
export interface ModelFieldInfo {
    name: string;
    type: string;
    allowNull: boolean;
    primaryKey?: boolean;
    unique?: boolean;
    defaultValue?: any;
    description?: string;
}
export interface ModelInfo {
    name: string;
    tableName?: string;
    fields: ModelFieldInfo[];
}
export declare class SwaggerGenerator {
    private project;
    private config;
    private routes;
    private forms;
    private models;
    constructor(config: SwaggerGeneratorConfig);
    /**
     * Generate the complete OpenAPI specification
     */
    generate(): Promise<Record<string, any>>;
    /**
     * Parse all route files to extract route information
     */
    private parseRoutes;
    /**
     * Parse a single route file
     */
    private parseRouteFile;
    /**
     * Parse CRUD decorator to extract routes
     */
    private parseCRUDDecorator;
    /**
     * Parse method decorators to extract route information
     */
    private parseMethodDecorators;
    /**
     * Parse form files to extract form schema
     */
    private parseForms;
    /**
     * Parse a single form file
     */
    private parseFormFile;
    /**
     * Parse Yup schema to extract field information
     */
    private parseYupSchema;
    /**
     * Convert Yup type to OpenAPI type
     */
    private yupTypeToOpenAPIType;
    /**
     * Extract validation rules from Yup chain
     */
    private extractValidations;
    /**
     * Parse model files to extract schema
     */
    private parseModels;
    /**
     * Parse a single model file
     */
    private parseModelFile;
    /**
     * Convert TypeScript type to OpenAPI type
     */
    private tsTypeToOpenAPIType;
    /**
     * Convert Sequelize DataType to OpenAPI type
     */
    private dataTypeToOpenAPIType;
    /**
     * Build the complete OpenAPI specification
     */
    private buildOpenAPISpec;
    /**
     * Convert form info to OpenAPI schema
     */
    private formToSchema;
    /**
     * Convert model info to OpenAPI schema
     */
    private modelToSchema;
    /**
     * Normalize path to ensure consistent format
     */
    private normalizePath;
    /**
     * Get all files recursively from a directory
     */
    private getAllFilesRecursive;
    /**
     * Get routes for debugging
     */
    getRoutes(): RouteInfo[];
    /**
     * Get forms for debugging
     */
    getForms(): Map<string, FormInfo>;
    /**
     * Get models for debugging
     */
    getModels(): Map<string, ModelInfo>;
}
export default SwaggerGenerator;
