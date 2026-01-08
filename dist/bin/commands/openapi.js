var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { Project } from 'ts-morph';
export function openapiCommand() {
    return __awaiter(this, void 0, void 0, function* () {
        const projectPath = process.cwd();
        const spinner = ora('Analyzing project...').start();
        try {
            const srcPath = path.join(projectPath, 'src');
            if (!fs.existsSync(srcPath)) {
                spinner.fail('Source directory not found');
                console.log(chalk.yellow('Make sure you are in a project root with a src/ directory'));
                return;
            }
            // Get project name
            let projectName = 'Etherial API';
            const packageJsonPath = path.join(projectPath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                try {
                    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                    projectName = pkg.name || projectName;
                }
                catch (_a) { }
            }
            // Collect all paths to analyze
            const routesPaths = [];
            const modelsPaths = [];
            const formsPaths = [];
            // Standard paths
            const standardRoutes = path.join(srcPath, 'routes');
            const standardModels = path.join(srcPath, 'models');
            const standardForms = path.join(srcPath, 'forms');
            if (fs.existsSync(standardRoutes))
                routesPaths.push(standardRoutes);
            if (fs.existsSync(standardModels))
                modelsPaths.push(standardModels);
            if (fs.existsSync(standardForms))
                formsPaths.push(standardForms);
            // Detect Leafs
            const leafs = detectLeafs(srcPath);
            for (const leafPath of leafs) {
                const lr = path.join(leafPath, 'routes');
                const lm = path.join(leafPath, 'models');
                const lf = path.join(leafPath, 'forms');
                if (fs.existsSync(lr))
                    routesPaths.push(lr);
                if (fs.existsSync(lm))
                    modelsPaths.push(lm);
                if (fs.existsSync(lf))
                    formsPaths.push(lf);
            }
            spinner.text = 'Analyzing routes...';
            // Create ts-morph project
            const project = new Project({ skipAddingFilesFromTsConfig: true });
            // Analyze routes
            const routes = analyzeRoutes(project, routesPaths);
            spinner.text = 'Analyzing models...';
            // Analyze models
            const modelSchemas = analyzeModels(project, modelsPaths);
            spinner.text = 'Analyzing forms...';
            // Analyze Yup forms
            const formSchemas = analyzeYupForms(project, formsPaths);
            spinner.text = 'Generating OpenAPI spec...';
            // Generate spec
            const spec = {
                openapi: '3.0.0',
                info: { title: projectName, version: '1.0.0' },
                paths: {},
                components: {
                    schemas: Object.assign(Object.assign({}, modelSchemas), formSchemas),
                    securitySchemes: {
                        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
                    }
                },
                tags: []
            };
            // Build tags from controllers
            const controllers = new Set(routes.map(r => r.controllerName));
            for (const ctrl of controllers) {
                spec.tags.push({ name: ctrl, description: `${ctrl} endpoints` });
            }
            // Build paths
            for (const route of routes) {
                const openApiPath = route.path.replace(/:(\w+)/g, '{$1}');
                if (!spec.paths[openApiPath]) {
                    spec.paths[openApiPath] = {};
                }
                const operation = {
                    summary: route.methodName,
                    description: route.description,
                    tags: [route.controllerName],
                    operationId: `${route.controllerName}_${route.methodName}`,
                    responses: {
                        '200': {
                            description: 'Success',
                            content: {
                                'application/json': {
                                    schema: buildResponseSchema(route, modelSchemas)
                                }
                            }
                        },
                        '400': { description: 'Bad Request' },
                        '401': { description: 'Unauthorized' },
                        '404': { description: 'Not Found' },
                        '500': { description: 'Internal Server Error' }
                    }
                };
                // Add path parameters
                const pathParams = route.path.match(/:(\w+)/g);
                if (pathParams) {
                    operation.parameters = pathParams.map(p => ({
                        name: p.substring(1),
                        in: 'path',
                        required: true,
                        schema: { type: 'string' }
                    }));
                }
                // Add request body from form schema
                if (['post', 'put', 'patch'].includes(route.method) && route.formSchemaName) {
                    const schemaRef = formSchemas[route.formSchemaName]
                        ? { $ref: `#/components/schemas/${route.formSchemaName}` }
                        : { type: 'object' };
                    operation.requestBody = {
                        required: true,
                        content: { 'application/json': { schema: schemaRef } }
                    };
                }
                // Add security
                if (route.hasAuth) {
                    operation.security = [{ bearerAuth: [] }];
                }
                spec.paths[openApiPath][route.method] = operation;
            }
            // Write file
            const outputPath = path.join(projectPath, 'openapi.json');
            fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
            spinner.succeed(chalk.green('openapi.json generated successfully!'));
            console.log('');
            console.log(chalk.cyan('📊 Summary:'));
            console.log(chalk.white(`   • Routes: ${routes.length}`));
            console.log(chalk.white(`   • Schemas: ${Object.keys(spec.components.schemas).length}`));
            console.log(chalk.white(`   • Models: ${Object.keys(modelSchemas).length}`));
            console.log(chalk.white(`   • Forms: ${Object.keys(formSchemas).length}`));
            if (leafs.length > 0) {
                console.log(chalk.white(`   • Leafs: ${leafs.length}`));
            }
            console.log('');
            console.log(chalk.gray(`   Output: ${outputPath}`));
        }
        catch (error) {
            spinner.fail('Failed to generate OpenAPI spec');
            console.error(chalk.red(error.message));
            if (process.env.DEBUG) {
                console.error(error);
            }
        }
    });
}
// ============================================
// Route Analysis (Enhanced)
// ============================================
function analyzeRoutes(project, routesPaths) {
    const routes = [];
    for (const routePath of routesPaths) {
        const files = getTypeScriptFiles(routePath);
        for (const filePath of files) {
            const sourceFile = project.addSourceFileAtPath(filePath);
            routes.push(...extractRoutesFromFile(sourceFile));
        }
    }
    return routes;
}
function extractRoutesFromFile(sourceFile) {
    const routes = [];
    const classes = sourceFile.getClasses();
    for (const classDecl of classes) {
        const controllerDeco = classDecl.getDecorator('Controller');
        if (!controllerDeco)
            continue;
        const prefix = getDecoratorStringArg(controllerDeco) || '';
        const controllerName = classDecl.getName() || 'Controller';
        for (const method of classDecl.getMethods()) {
            const methodName = method.getName();
            const httpMethods = ['Get', 'Post', 'Put', 'Patch', 'Delete'];
            for (const httpMethod of httpMethods) {
                const deco = method.getDecorator(httpMethod);
                if (!deco)
                    continue;
                const routePath = getDecoratorStringArg(deco) || '/';
                const fullPath = normalizePath(prefix + routePath);
                // Extract form schema
                let formSchemaName;
                let formSchemaLocation = 'body';
                const yupDeco = method.getDecorator('ShouldValidateYupForm');
                if (yupDeco) {
                    const args = yupDeco.getArguments();
                    if (args.length > 0) {
                        formSchemaName = args[0].getText();
                    }
                    if (args.length > 1) {
                        const loc = args[1].getText().replace(/['"]/g, '');
                        if (['body', 'query', 'params'].includes(loc)) {
                            formSchemaLocation = loc;
                        }
                    }
                }
                // Extract model usage
                let modelName;
                let modelOperation;
                const modelDecos = [
                    'ShouldFindAllFromModel', 'ShouldFindOneFromModel', 'ShouldCreateFromModel',
                    'ShouldUpdateFromModel', 'ShouldDeleteFromModel', 'ShouldSearchInModel'
                ];
                for (const modelDeco of modelDecos) {
                    const md = method.getDecorator(modelDeco);
                    if (md) {
                        const args = md.getArguments();
                        if (args.length > 0) {
                            modelName = args[0].getText();
                            modelOperation = modelDeco.replace('Should', '').replace('FromModel', '').replace('InModel', '').toLowerCase();
                        }
                        break;
                    }
                }
                // Check for auth
                const hasAuth = checkForAuth(method);
                // Extract @OpenAPIResponseSchema or @ResponseSchema decorator
                let responseSchemaName;
                let responseInlineSchema;
                let responseIsArray = false;
                const responseDeco = method.getDecorator('OpenAPIResponseSchema') || method.getDecorator('ResponseSchema');
                if (responseDeco) {
                    const args = responseDeco.getArguments();
                    if (args.length > 0) {
                        const firstArg = args[0].getText();
                        // Check if it's an inline schema object (starts with {)
                        if (firstArg.trim().startsWith('{')) {
                            // It's an inline schema - parse it
                            responseInlineSchema = parseInlineSchema(firstArg);
                        }
                        else {
                            // It's a Model reference
                            responseSchemaName = firstArg;
                        }
                    }
                    if (args.length > 1) {
                        const optionsText = args[1].getText();
                        if (optionsText.includes('isArray: true') || optionsText.includes('isArray:true')) {
                            responseIsArray = true;
                        }
                    }
                }
                // Get JSDoc description
                const jsDocs = method.getJsDocs();
                const description = jsDocs.length > 0 ? jsDocs[0].getDescription().trim() : undefined;
                routes.push({
                    path: fullPath,
                    method: httpMethod.toLowerCase(),
                    methodName,
                    controllerName,
                    prefix,
                    formSchemaName,
                    formSchemaLocation,
                    modelName,
                    modelOperation,
                    responseSchemaName,
                    responseInlineSchema,
                    responseIsArray,
                    hasAuth,
                    description
                });
                break;
            }
        }
    }
    return routes;
}
function checkForAuth(method) {
    // Check model decorators for canAccess
    const modelDecos = [
        'ShouldFindAllFromModel', 'ShouldFindOneFromModel', 'ShouldCreateFromModel',
        'ShouldUpdateFromModel', 'ShouldDeleteFromModel'
    ];
    for (const name of modelDecos) {
        const deco = method.getDecorator(name);
        if (deco) {
            const args = deco.getArguments();
            if (args.length > 1 && args[1].getText().includes('canAccess')) {
                return true;
            }
        }
    }
    // Check Middleware decorator
    const middlewareDeco = method.getDecorator('Middleware');
    if (middlewareDeco) {
        const text = middlewareDeco.getText().toLowerCase();
        if (text.includes('auth') || text.includes('jwt') || text.includes('token')) {
            return true;
        }
    }
    return false;
}
// ============================================
// Model Analysis (Enhanced with inheritance)
// ============================================
function analyzeModels(project, modelsPaths) {
    const schemas = {};
    for (const modelPath of modelsPaths) {
        const files = getTypeScriptFiles(modelPath);
        for (const filePath of files) {
            const sourceFile = project.addSourceFileAtPath(filePath);
            for (const classDecl of sourceFile.getClasses()) {
                const tableDeco = classDecl.getDecorator('Table');
                if (!tableDeco)
                    continue;
                const modelName = classDecl.getName() || 'Model';
                const properties = {};
                const required = [];
                // Get properties from this class AND parent classes
                const allProperties = classDecl.getProperties();
                for (const prop of allProperties) {
                    // Check for @Column decorator
                    const columnDeco = prop.getDecorator('Column');
                    if (!columnDeco)
                        continue;
                    const propName = prop.getName();
                    const propType = prop.getType().getText();
                    // Get type from DataType decorator or TypeScript type
                    let schemaType = 'string';
                    let format;
                    const columnArgs = columnDeco.getArguments();
                    if (columnArgs.length > 0) {
                        const argText = columnArgs[0].getText();
                        if (argText.includes('INTEGER') || argText.includes('BIGINT')) {
                            schemaType = 'integer';
                        }
                        else if (argText.includes('FLOAT') || argText.includes('DOUBLE') || argText.includes('DECIMAL')) {
                            schemaType = 'number';
                        }
                        else if (argText.includes('BOOLEAN')) {
                            schemaType = 'boolean';
                        }
                        else if (argText.includes('DATE')) {
                            schemaType = 'string';
                            format = 'date-time';
                        }
                        else if (argText.includes('UUID')) {
                            schemaType = 'string';
                            format = 'uuid';
                        }
                    }
                    else {
                        // Fallback to TS type
                        schemaType = mapTsType(propType);
                    }
                    const propSchema = { type: schemaType };
                    if (format)
                        propSchema.format = format;
                    properties[propName] = propSchema;
                    // Check if not nullable
                    const allowNullDeco = prop.getDecorator('AllowNull');
                    if (allowNullDeco) {
                        const args = allowNullDeco.getArguments();
                        if (args.length > 0 && args[0].getText() === 'false') {
                            required.push(propName);
                        }
                    }
                }
                schemas[modelName] = {
                    type: 'object',
                    properties,
                    required: required.length > 0 ? required : undefined
                };
            }
        }
    }
    return schemas;
}
// ============================================
// Yup Form Analysis (Enhanced)
// ============================================
function analyzeYupForms(project, formsPaths) {
    const schemas = {};
    for (const formPath of formsPaths) {
        const files = getTypeScriptFiles(formPath);
        for (const filePath of files) {
            const sourceFile = project.addSourceFileAtPath(filePath);
            for (const varDecl of sourceFile.getVariableDeclarations()) {
                const name = varDecl.getName();
                const init = varDecl.getInitializer();
                if (!init)
                    continue;
                const text = init.getText();
                // Check if it's a Yup object schema
                if (text.includes('.object(') || text.includes('object({')) {
                    const schema = parseYupSchema(text);
                    if (schema && Object.keys(schema.properties || {}).length > 0) {
                        schemas[name] = schema;
                    }
                }
            }
        }
    }
    return schemas;
}
function parseYupSchema(text) {
    const schema = {
        type: 'object',
        properties: {},
        required: []
    };
    // Enhanced regex to capture field definitions
    // Match: fieldName: EtherialYup.string() or yup.string() patterns
    const patterns = [
        /(\w+):\s*(?:EtherialYup|yup)\.(string|number|boolean|date|array|mixed)\(\)/g,
        /(\w+):\s*(?:EtherialYup|yup)\.(string|number|boolean|date|array|mixed)\(\)\.([^,\n]+)/g
    ];
    // First pass: extract field names and types
    const fieldRegex = /(\w+):\s*(?:EtherialYup|yup)\.(string|number|boolean|date|array|mixed)\(\)/g;
    let match;
    while ((match = fieldRegex.exec(text)) !== null) {
        const fieldName = match[1];
        const fieldType = match[2];
        const propSchema = { type: mapYupType(fieldType) };
        // Check for common validations in the chain after this field
        const fieldPattern = new RegExp(`${fieldName}:[^,}]+`, 'g');
        const fieldMatch = fieldPattern.exec(text);
        if (fieldMatch) {
            const fieldDef = fieldMatch[0];
            // Check for required
            if (fieldDef.includes('.required(')) {
                schema.required.push(fieldName);
            }
            // Check for email
            if (fieldDef.includes('.email(')) {
                propSchema.format = 'email';
            }
            // Check for uuid/matches with uuid pattern
            if (fieldDef.includes('uuid') || fieldDef.includes('UUID')) {
                propSchema.format = 'uuid';
            }
            // Check for url
            if (fieldDef.includes('.url(')) {
                propSchema.format = 'uri';
            }
            // Check for min/max
            const minMatch = fieldDef.match(/\.min\((\d+)/);
            if (minMatch) {
                if (fieldType === 'string') {
                    propSchema.minLength = parseInt(minMatch[1]);
                }
                else {
                    propSchema.minimum = parseInt(minMatch[1]);
                }
            }
            const maxMatch = fieldDef.match(/\.max\((\d+)/);
            if (maxMatch) {
                if (fieldType === 'string') {
                    propSchema.maxLength = parseInt(maxMatch[1]);
                }
                else {
                    propSchema.maximum = parseInt(maxMatch[1]);
                }
            }
            // Check for oneOf (enum)
            const oneOfMatch = fieldDef.match(/\.oneOf\(\[([^\]]+)\]/);
            if (oneOfMatch) {
                propSchema.enum = oneOfMatch[1]
                    .split(',')
                    .map(v => v.trim().replace(/['"]/g, ''));
            }
        }
        schema.properties[fieldName] = propSchema;
    }
    return schema;
}
// ============================================
// Response Schema Builder
// ============================================
function buildResponseSchema(route, modelSchemas) {
    // Priority 1a: Use @OpenAPIResponseSchema with inline schema
    if (route.responseInlineSchema && Object.keys(route.responseInlineSchema).length > 0) {
        const inlineSchema = {
            type: 'object',
            properties: route.responseInlineSchema
        };
        if (route.responseIsArray) {
            return {
                type: 'object',
                properties: {
                    status: { type: 'number', example: 200 },
                    data: {
                        type: 'array',
                        items: inlineSchema
                    },
                    count: { type: 'number' }
                }
            };
        }
        return {
            type: 'object',
            properties: {
                status: { type: 'number', example: 200 },
                data: inlineSchema
            }
        };
    }
    // Priority 1b: Use @OpenAPIResponseSchema with Model reference
    if (route.responseSchemaName) {
        const schemaName = route.responseSchemaName;
        if (route.responseIsArray) {
            return {
                type: 'object',
                properties: {
                    status: { type: 'number', example: 200 },
                    data: {
                        type: 'array',
                        items: { $ref: `#/components/schemas/${schemaName}` }
                    },
                    count: { type: 'number' }
                }
            };
        }
        return {
            type: 'object',
            properties: {
                status: { type: 'number', example: 200 },
                data: { $ref: `#/components/schemas/${schemaName}` }
            }
        };
    }
    // Priority 2: Use model from CRUD decorators
    if (route.modelName) {
        const isList = ['findall', 'search'].includes(route.modelOperation || '');
        if (isList) {
            return {
                type: 'object',
                properties: {
                    status: { type: 'number', example: 200 },
                    data: {
                        type: 'array',
                        items: { $ref: `#/components/schemas/${route.modelName}` }
                    },
                    count: { type: 'number' }
                }
            };
        }
        return {
            type: 'object',
            properties: {
                status: { type: 'number', example: 200 },
                data: { $ref: `#/components/schemas/${route.modelName}` }
            }
        };
    }
    // Fallback: generic response
    return {
        type: 'object',
        properties: {
            status: { type: 'number', example: 200 },
            data: { type: 'object' }
        }
    };
}
// ============================================
// Helpers
// ============================================
function detectLeafs(srcPath) {
    const leafs = [];
    try {
        const entries = fs.readdirSync(srcPath, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            const dirPath = path.join(srcPath, entry.name);
            if (fs.existsSync(path.join(dirPath, 'leaf.json')) || /^ETH\w+Leaf$/.test(entry.name)) {
                leafs.push(dirPath);
            }
        }
    }
    catch (_a) { }
    return leafs;
}
/**
 * Parse inline schema object from decorator argument text
 * e.g., "{ totalUsers: { type: 'number' }, name: { type: 'string' } }"
 */
function parseInlineSchema(text) {
    const properties = {};
    // Match patterns like: fieldName: { type: 'string' } or fieldName: { type: 'number', format: 'xxx' }
    const fieldPattern = /(\w+):\s*\{\s*type:\s*['"](\w+)['"]/g;
    let match;
    while ((match = fieldPattern.exec(text)) !== null) {
        const fieldName = match[1];
        const fieldType = match[2];
        const propSchema = { type: fieldType };
        // Check for format in this field's definition
        const fieldSection = text.slice(match.index, text.indexOf('}', match.index) + 1);
        const formatMatch = fieldSection.match(/format:\s*['"]([^'"]+)['"]/);
        if (formatMatch) {
            propSchema.format = formatMatch[1];
        }
        properties[fieldName] = propSchema;
    }
    return properties;
}
function getTypeScriptFiles(dirPath) {
    if (!fs.existsSync(dirPath))
        return [];
    const stat = fs.statSync(dirPath);
    if (stat.isFile())
        return [dirPath];
    return fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
        .map(f => path.join(dirPath, f));
}
function getDecoratorStringArg(decorator) {
    const args = decorator.getArguments();
    if (args.length === 0)
        return undefined;
    const text = args[0].getText();
    if (text.startsWith('{')) {
        const match = text.match(/prefix:\s*['"]([^'"]+)['"]/);
        return match ? match[1] : undefined;
    }
    return text.replace(/['"]/g, '');
}
function normalizePath(p) {
    return p.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}
function mapTsType(t) {
    if (t.includes('number'))
        return 'number';
    if (t.includes('boolean'))
        return 'boolean';
    return 'string';
}
function mapYupType(t) {
    const map = {
        string: 'string',
        number: 'number',
        boolean: 'boolean',
        date: 'string',
        array: 'array',
        mixed: 'object'
    };
    return map[t] || 'string';
}
// ============================================
// Export
// ============================================
export const command = {
    name: 'openapi',
    description: 'Generate OpenAPI specification from project',
    action: openapiCommand
};
