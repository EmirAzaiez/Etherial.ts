var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Project, Node } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';
export class SwaggerGenerator {
    constructor(config) {
        this.routes = [];
        this.forms = new Map();
        this.models = new Map();
        this.config = config;
        this.project = new Project({
            skipAddingFilesFromTsConfig: true,
        });
    }
    /**
     * Generate the complete OpenAPI specification
     */
    generate() {
        return __awaiter(this, void 0, void 0, function* () {
            // Parse all routes
            yield this.parseRoutes();
            // Parse all forms
            if (this.config.formsPaths) {
                yield this.parseForms();
            }
            // Parse all models
            if (this.config.modelsPaths) {
                yield this.parseModels();
            }
            // Build OpenAPI spec
            const spec = this.buildOpenAPISpec();
            // Write to file if outputPath is provided
            if (this.config.outputPath) {
                fs.writeFileSync(this.config.outputPath, JSON.stringify(spec, null, 2));
            }
            return spec;
        });
    }
    /**
     * Parse all route files to extract route information
     */
    parseRoutes() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const routePath of this.config.routesPaths) {
                try {
                    const stat = fs.statSync(routePath);
                    if (stat.isFile() && (routePath.endsWith('.ts') || routePath.endsWith('.js'))) {
                        yield this.parseRouteFile(routePath);
                    }
                    else if (stat.isDirectory()) {
                        const files = this.getAllFilesRecursive(routePath);
                        for (const file of files) {
                            if (file.endsWith('.ts') || file.endsWith('.js')) {
                                yield this.parseRouteFile(file);
                            }
                        }
                    }
                }
                catch (error) {
                    console.warn(`Warning: Could not parse route path ${routePath}:`, error);
                }
            }
        });
    }
    /**
     * Parse a single route file
     */
    parseRouteFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sourceFile = this.project.addSourceFileAtPath(filePath);
                const classes = sourceFile.getClasses();
                for (const classDecl of classes) {
                    const controllerDecorator = classDecl.getDecorator('Controller');
                    if (!controllerDecorator)
                        continue;
                    const controllerName = classDecl.getName() || 'UnknownController';
                    // Extract prefix from @Controller decorator
                    let prefix = '';
                    const args = controllerDecorator.getArguments();
                    if (args.length > 0) {
                        const arg = args[0];
                        if (Node.isStringLiteral(arg)) {
                            prefix = arg.getLiteralValue();
                        }
                        else if (Node.isObjectLiteralExpression(arg)) {
                            const prefixProp = arg.getProperty('prefix');
                            if (prefixProp && Node.isPropertyAssignment(prefixProp)) {
                                const initializer = prefixProp.getInitializer();
                                if (initializer && Node.isStringLiteral(initializer)) {
                                    prefix = initializer.getLiteralValue();
                                }
                            }
                        }
                    }
                    // Extract CRUD decorator info
                    const crudDecorator = classDecl.getDecorator('CRUD');
                    if (crudDecorator) {
                        this.parseCRUDDecorator(crudDecorator, controllerName);
                    }
                    // Parse methods
                    const methods = classDecl.getMethods();
                    for (const method of methods) {
                        const routeInfo = this.parseMethodDecorators(method, controllerName, prefix, sourceFile);
                        if (routeInfo) {
                            this.routes.push(routeInfo);
                        }
                    }
                }
            }
            catch (error) {
                console.warn(`Warning: Could not parse file ${filePath}:`, error);
            }
        });
    }
    /**
     * Parse CRUD decorator to extract routes
     */
    parseCRUDDecorator(decorator, controllerName) {
        const args = decorator.getArguments();
        if (args.length < 2)
            return;
        const prefixArg = args[0];
        let prefix = '';
        if (Node.isStringLiteral(prefixArg)) {
            prefix = prefixArg.getLiteralValue();
        }
        // Generate CRUD routes
        const crudRoutes = [
            { path: '/', method: 'get', methodName: 'findAll', summary: `List all ${controllerName}` },
            { path: '/:id', method: 'get', methodName: 'findOne', summary: `Get one ${controllerName}` },
            { path: '/', method: 'post', methodName: 'create', summary: `Create ${controllerName}` },
            { path: '/:id', method: 'put', methodName: 'update', summary: `Update ${controllerName}` },
            { path: '/:id', method: 'delete', methodName: 'delete', summary: `Delete ${controllerName}` },
        ];
        for (const route of crudRoutes) {
            this.routes.push(Object.assign(Object.assign({}, route), { controllerName,
                prefix, requiresAuth: false, tags: [controllerName.replace('Controller', '')] }));
        }
    }
    /**
     * Parse method decorators to extract route information
     */
    parseMethodDecorators(method, controllerName, prefix, sourceFile) {
        var _a, _b;
        const decorators = method.getDecorators();
        const methodName = method.getName();
        let routeInfo = {
            methodName,
            controllerName,
            prefix,
            requiresAuth: false,
            tags: [controllerName.replace('Controller', '').replace('ETH', '').replace('Leaf', '')],
        };
        // Extract JSDoc comments
        const jsDocs = method.getJsDocs();
        if (jsDocs.length > 0) {
            const jsDoc = jsDocs[0];
            routeInfo.description = (_a = jsDoc.getDescription()) === null || _a === void 0 ? void 0 : _a.trim();
            // Extract @summary tag
            const summaryTag = jsDoc.getTags().find((t) => t.getTagName() === 'summary');
            if (summaryTag) {
                routeInfo.summary = (_b = summaryTag.getCommentText()) === null || _b === void 0 ? void 0 : _b.trim();
            }
        }
        for (const decorator of decorators) {
            const decoratorName = decorator.getName();
            const args = decorator.getArguments();
            // HTTP Method decorators
            if (['Get', 'Post', 'Put', 'Delete', 'Patch'].includes(decoratorName)) {
                routeInfo.method = decoratorName.toLowerCase();
                if (args.length > 0 && Node.isStringLiteral(args[0])) {
                    routeInfo.path = args[0].getLiteralValue();
                }
                // Extract path parameters
                if (routeInfo.path) {
                    const pathParams = routeInfo.path.match(/:(\w+)/g);
                    if (pathParams) {
                        routeInfo.parameters = pathParams.map((param) => ({
                            name: param.replace(':', ''),
                            in: 'path',
                            required: true,
                            type: 'string',
                        }));
                    }
                }
            }
            // Auth decorator
            if (decoratorName === 'ShouldBeAuthentificate' || decoratorName === 'ShouldBeAuthenticated') {
                routeInfo.requiresAuth = true;
            }
            // Form validation decorator
            if (decoratorName === 'ShouldValidateYupForm' || decoratorName === 'ShouldValidateForm') {
                if (args.length > 0) {
                    const formArg = args[0];
                    if (Node.isIdentifier(formArg)) {
                        routeInfo.formName = formArg.getText();
                        // Try to find the form import
                        const imports = sourceFile.getImportDeclarations();
                        for (const imp of imports) {
                            const namedImports = imp.getNamedImports();
                            for (const namedImport of namedImports) {
                                if (namedImport.getName() === routeInfo.formName) {
                                    const moduleSpecifier = imp.getModuleSpecifierValue();
                                    routeInfo.formFile = moduleSpecifier;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        // Only return if we have a valid route method
        if (routeInfo.method && routeInfo.path) {
            return routeInfo;
        }
        return null;
    }
    /**
     * Parse form files to extract form schema
     */
    parseForms() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const formPath of this.config.formsPaths) {
                try {
                    const stat = fs.statSync(formPath);
                    if (stat.isFile()) {
                        yield this.parseFormFile(formPath);
                    }
                    else if (stat.isDirectory()) {
                        const files = this.getAllFilesRecursive(formPath);
                        for (const file of files) {
                            if (file.endsWith('.ts') || file.endsWith('.js')) {
                                yield this.parseFormFile(file);
                            }
                        }
                    }
                }
                catch (error) {
                    console.warn(`Warning: Could not parse form path ${formPath}:`, error);
                }
            }
        });
    }
    /**
     * Parse a single form file
     */
    parseFormFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sourceFile = this.project.addSourceFileAtPath(filePath);
                const variableStatements = sourceFile.getVariableStatements();
                for (const statement of variableStatements) {
                    for (const declaration of statement.getDeclarations()) {
                        const name = declaration.getName();
                        const initializer = declaration.getInitializer();
                        if (initializer && name.endsWith('Form')) {
                            const formInfo = this.parseYupSchema(name, initializer);
                            if (formInfo) {
                                this.forms.set(name, formInfo);
                            }
                        }
                    }
                }
            }
            catch (error) {
                console.warn(`Warning: Could not parse form file ${filePath}:`, error);
            }
        });
    }
    /**
     * Parse Yup schema to extract field information
     */
    parseYupSchema(name, initializer) {
        const fields = [];
        // Get the full text and try to parse it
        const text = initializer.getText();
        // Match field definitions like: fieldName: EtherialYup.string().required()
        const fieldMatches = text.matchAll(/(\w+):\s*(?:EtherialYup|Yup|EtherialYupS3)\.(\w+)\(\)([^,}]*)/g);
        for (const match of fieldMatches) {
            const fieldName = match[1];
            const fieldType = match[2];
            const validations = match[3];
            const isRequired = validations.includes('.required()');
            fields.push({
                name: fieldName,
                type: this.yupTypeToOpenAPIType(fieldType),
                required: isRequired,
                validations: this.extractValidations(validations),
            });
        }
        if (fields.length > 0) {
            return { name, fields };
        }
        return null;
    }
    /**
     * Convert Yup type to OpenAPI type
     */
    yupTypeToOpenAPIType(yupType) {
        const typeMap = {
            string: 'string',
            number: 'number',
            boolean: 'boolean',
            date: 'string',
            array: 'array',
            object: 'object',
            mixed: 'any',
        };
        return typeMap[yupType] || 'string';
    }
    /**
     * Extract validation rules from Yup chain
     */
    extractValidations(validationChain) {
        const validations = [];
        if (validationChain.includes('.email()'))
            validations.push('email');
        if (validationChain.includes('.required()'))
            validations.push('required');
        if (validationChain.includes('.min(')) {
            const match = validationChain.match(/\.min\((\d+)\)/);
            if (match)
                validations.push(`min:${match[1]}`);
        }
        if (validationChain.includes('.max(')) {
            const match = validationChain.match(/\.max\((\d+)\)/);
            if (match)
                validations.push(`max:${match[1]}`);
        }
        return validations;
    }
    /**
     * Parse model files to extract schema
     */
    parseModels() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const modelPath of this.config.modelsPaths) {
                try {
                    const stat = fs.statSync(modelPath);
                    if (stat.isFile()) {
                        yield this.parseModelFile(modelPath);
                    }
                    else if (stat.isDirectory()) {
                        const files = this.getAllFilesRecursive(modelPath);
                        for (const file of files) {
                            if (file.endsWith('.ts') || file.endsWith('.js')) {
                                yield this.parseModelFile(file);
                            }
                        }
                    }
                }
                catch (error) {
                    console.warn(`Warning: Could not parse model path ${modelPath}:`, error);
                }
            }
        });
    }
    /**
     * Parse a single model file
     */
    parseModelFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const sourceFile = this.project.addSourceFileAtPath(filePath);
                const classes = sourceFile.getClasses();
                for (const classDecl of classes) {
                    const hasModelDecorator = classDecl.getDecorator('Table') ||
                        ((_a = classDecl.getExtends()) === null || _a === void 0 ? void 0 : _a.getText().includes('Model'));
                    if (!hasModelDecorator)
                        continue;
                    const modelName = classDecl.getName() || 'UnknownModel';
                    const fields = [];
                    // Get table name from decorator if available
                    let tableName = modelName.toLowerCase();
                    const tableDecorator = classDecl.getDecorator('Table');
                    if (tableDecorator) {
                        const args = tableDecorator.getArguments();
                        if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
                            const tableNameProp = args[0].getProperty('tableName');
                            if (tableNameProp && Node.isPropertyAssignment(tableNameProp)) {
                                const initializer = tableNameProp.getInitializer();
                                if (initializer && Node.isStringLiteral(initializer)) {
                                    tableName = initializer.getLiteralValue();
                                }
                            }
                        }
                    }
                    // Parse properties
                    const properties = classDecl.getProperties();
                    for (const prop of properties) {
                        const propName = prop.getName();
                        const propType = prop.getType().getText();
                        const decorators = prop.getDecorators();
                        let fieldInfo = {
                            name: propName,
                            type: this.tsTypeToOpenAPIType(propType),
                            allowNull: true,
                        };
                        for (const decorator of decorators) {
                            const decName = decorator.getName();
                            if (decName === 'PrimaryKey')
                                fieldInfo.primaryKey = true;
                            if (decName === 'Unique')
                                fieldInfo.unique = true;
                            if (decName === 'AllowNull') {
                                const args = decorator.getArguments();
                                if (args.length > 0) {
                                    fieldInfo.allowNull = args[0].getText() !== 'false';
                                }
                            }
                            if (decName === 'Default') {
                                const args = decorator.getArguments();
                                if (args.length > 0) {
                                    fieldInfo.defaultValue = args[0].getText();
                                }
                            }
                            if (decName === 'Column') {
                                const args = decorator.getArguments();
                                if (args.length > 0) {
                                    const argText = args[0].getText();
                                    if (argText.includes('DataType.')) {
                                        fieldInfo.type = this.dataTypeToOpenAPIType(argText);
                                    }
                                }
                            }
                        }
                        fields.push(fieldInfo);
                    }
                    this.models.set(modelName, {
                        name: modelName,
                        tableName,
                        fields,
                    });
                }
            }
            catch (error) {
                console.warn(`Warning: Could not parse model file ${filePath}:`, error);
            }
        });
    }
    /**
     * Convert TypeScript type to OpenAPI type
     */
    tsTypeToOpenAPIType(tsType) {
        if (tsType.includes('string'))
            return 'string';
        if (tsType.includes('number'))
            return 'integer';
        if (tsType.includes('boolean'))
            return 'boolean';
        if (tsType.includes('Date'))
            return 'string';
        if (tsType.includes('Record') || tsType.includes('object'))
            return 'object';
        if (tsType.includes('[]') || tsType.includes('Array'))
            return 'array';
        return 'string';
    }
    /**
     * Convert Sequelize DataType to OpenAPI type
     */
    dataTypeToOpenAPIType(dataType) {
        if (dataType.includes('TEXT'))
            return 'string';
        if (dataType.includes('JSON'))
            return 'object';
        if (dataType.includes('INTEGER') || dataType.includes('BIGINT'))
            return 'integer';
        if (dataType.includes('FLOAT') || dataType.includes('DOUBLE') || dataType.includes('DECIMAL'))
            return 'number';
        if (dataType.includes('BOOLEAN'))
            return 'boolean';
        if (dataType.includes('DATE'))
            return 'string';
        if (dataType.includes('GEOMETRY'))
            return 'object';
        return 'string';
    }
    /**
     * Build the complete OpenAPI specification
     */
    buildOpenAPISpec() {
        const paths = {};
        const tags = new Set();
        // Build paths from routes
        for (const route of this.routes) {
            const fullPath = this.normalizePath(route.prefix + route.path);
            const openAPIPath = fullPath.replace(/:(\w+)/g, '{$1}');
            if (!paths[openAPIPath]) {
                paths[openAPIPath] = {};
            }
            // Collect tags
            if (route.tags) {
                route.tags.forEach((tag) => tags.add(tag));
            }
            const operation = {
                summary: route.summary || `${route.method.toUpperCase()} ${fullPath}`,
                description: route.description,
                tags: route.tags || [],
                operationId: `${route.controllerName}_${route.methodName}`,
                responses: {
                    '200': {
                        description: 'Successful response',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'integer', example: 200 },
                                        data: { type: 'object' },
                                    },
                                },
                            },
                        },
                    },
                    '400': {
                        description: 'Bad request',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    '404': {
                        description: 'Not found',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                    '500': {
                        description: 'Internal server error',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/ErrorResponse' },
                            },
                        },
                    },
                },
            };
            // Add security requirement if auth is needed
            if (route.requiresAuth) {
                operation.security = [{ BearerAuth: [] }];
                operation.responses['401'] = {
                    description: 'Unauthorized',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ErrorResponse' },
                        },
                    },
                };
                operation.responses['403'] = {
                    description: 'Forbidden',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/ErrorResponse' },
                        },
                    },
                };
            }
            // Add path parameters
            if (route.parameters && route.parameters.length > 0) {
                operation.parameters = route.parameters.map((param) => ({
                    name: param.name,
                    in: param.in,
                    required: param.required,
                    schema: { type: param.type },
                    description: param.description,
                }));
            }
            // Add request body if form is defined
            if (route.formName && ['post', 'put', 'patch'].includes(route.method)) {
                const form = this.forms.get(route.formName);
                if (form) {
                    operation.requestBody = {
                        required: true,
                        content: {
                            'application/json': {
                                schema: this.formToSchema(form),
                            },
                        },
                    };
                }
                else {
                    // Reference the form schema
                    operation.requestBody = {
                        required: true,
                        content: {
                            'application/json': {
                                schema: { $ref: `#/components/schemas/${route.formName}` },
                            },
                        },
                    };
                }
            }
            paths[openAPIPath][route.method] = operation;
        }
        // Build schemas
        const schemas = {
            ErrorResponse: {
                type: 'object',
                properties: {
                    status: { type: 'integer', example: 400 },
                    errors: {
                        type: 'array',
                        items: {
                            oneOf: [
                                { type: 'string' },
                                {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        field: { type: 'string' },
                                    },
                                },
                            ],
                        },
                    },
                    message: { type: 'string' },
                },
            },
            SuccessResponse: {
                type: 'object',
                properties: {
                    status: { type: 'integer', example: 200 },
                    data: { type: 'object' },
                    count: { type: 'integer' },
                    message: { type: 'string' },
                },
            },
        };
        // Add form schemas
        for (const [name, form] of this.forms) {
            schemas[name] = this.formToSchema(form);
        }
        // Add model schemas
        for (const [name, model] of this.models) {
            schemas[name] = this.modelToSchema(model);
        }
        // Build complete spec
        const spec = {
            openapi: '3.0.3',
            info: Object.assign(Object.assign({ title: this.config.info.title, description: this.config.info.description || 'API Documentation generated by Etherial', version: this.config.info.version }, (this.config.info.contact && { contact: this.config.info.contact })), (this.config.info.license && { license: this.config.info.license })),
            servers: this.config.servers,
            tags: Array.from(tags).map((tag) => ({
                name: tag,
                description: `${tag} operations`,
            })),
            paths,
            components: {
                schemas,
                securitySchemes: this.config.securitySchemes || {
                    BearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                        description: 'JWT Authorization header using the Bearer scheme',
                    },
                },
            },
        };
        return spec;
    }
    /**
     * Convert form info to OpenAPI schema
     */
    formToSchema(form) {
        var _a;
        const properties = {};
        const required = [];
        for (const field of form.fields) {
            properties[field.name] = {
                type: field.type,
                description: field.description,
            };
            // Add format for special types
            if ((_a = field.validations) === null || _a === void 0 ? void 0 : _a.includes('email')) {
                properties[field.name].format = 'email';
            }
            if (field.required) {
                required.push(field.name);
            }
        }
        return Object.assign({ type: 'object', properties }, (required.length > 0 && { required }));
    }
    /**
     * Convert model info to OpenAPI schema
     */
    modelToSchema(model) {
        const properties = {};
        const required = [];
        for (const field of model.fields) {
            let propSchema = {
                type: field.type,
            };
            if (field.type === 'string' && field.name.includes('_at')) {
                propSchema.format = 'date-time';
            }
            if (field.type === 'string' && field.name === 'email') {
                propSchema.format = 'email';
            }
            if (field.defaultValue !== undefined) {
                propSchema.default = field.defaultValue;
            }
            if (field.primaryKey) {
                propSchema.description = 'Primary key';
            }
            if (field.unique) {
                propSchema.description = (propSchema.description || '') + ' Unique';
            }
            properties[field.name] = propSchema;
            if (!field.allowNull && !field.primaryKey) {
                required.push(field.name);
            }
        }
        return Object.assign({ type: 'object', properties }, (required.length > 0 && { required }));
    }
    /**
     * Normalize path to ensure consistent format
     */
    normalizePath(pathStr) {
        // Remove double slashes
        let normalized = pathStr.replace(/\/+/g, '/');
        // Ensure starts with /
        if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }
        // Remove trailing slash (except for root)
        if (normalized.length > 1 && normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1);
        }
        return normalized;
    }
    /**
     * Get all files recursively from a directory
     */
    getAllFilesRecursive(dirPath) {
        const files = [];
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            const stat = fs.statSync(fullPath);
            if (stat.isFile()) {
                files.push(fullPath);
            }
            else if (stat.isDirectory()) {
                files.push(...this.getAllFilesRecursive(fullPath));
            }
        }
        return files;
    }
    /**
     * Get routes for debugging
     */
    getRoutes() {
        return this.routes;
    }
    /**
     * Get forms for debugging
     */
    getForms() {
        return this.forms;
    }
    /**
     * Get models for debugging
     */
    getModels() {
        return this.models;
    }
}
export default SwaggerGenerator;
//# sourceMappingURL=swagger-generator.js.map