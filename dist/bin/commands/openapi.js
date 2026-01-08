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
export function openapiCommand() {
    return __awaiter(this, void 0, void 0, function* () {
        const projectPath = process.cwd();
        // Find config file
        const configPath = findConfigFile(projectPath);
        if (!configPath) {
            console.log(chalk.red('\n❌ Config file not found.'));
            console.log(chalk.yellow('Make sure you have built your project: npm run build'));
            return;
        }
        const spinner = ora('Analyzing project...').start();
        try {
            const etherial = (yield import('etherial')).default;
            // Load etherial is passed as arg from index usually, but here we might be running standalone? 
            // Actually cmd system passes 'etherial' instance if called via 'cmd', but this is a specific command 'etherial openapi'
            // We need to replicate setup from cmd.ts if this is a standalone command.
            // Wait, looking at index.ts, 'openapi' will be exported.
            // Implementation below assumes it is called essentially like `cmd` does, 
            // BUT we need to initialize etherial first if it's not passed, or if we are the ones initializing it.
            // Since we are defining `src/bin/commands/openapi.ts`, we likely need to handle initialization.
            // Actually `index.ts` exports `initCommand`, `leaf...`, `cmdCommand`.
            // We will export `openapiCommand`.
            // Inspecting `bin/index.ts` (entry point) would clarify this, but assuming we need to bootstrap.
            // Load project config
            const config = (yield loadConfig(configPath)).default;
            // Initialize etherial
            etherial.init(config);
            yield etherial.run(); // Run lifecycle to register leafs
            // Find the Http module
            // const httpModule = etherial.modules.find((m: any) => m instanceof Http) as Http
            const httpModule = etherial.http;
            if (!httpModule) {
                spinner.fail('Http module not found in Etherial instance.');
                return;
            }
            spinner.text = 'Loading controllers...';
            // Load project controllers
            const controllers = yield httpModule.loadControllers();
            // Load leaf controllers
            const leafControllers = yield httpModule.loadLeafControllers();
            // Generate OpenAPI Spec
            const openApiSpec = {
                openapi: '3.0.0',
                info: {
                    title: config.name || 'Etherial Project',
                    version: '1.0.0',
                },
                paths: {},
                components: {
                    schemas: {},
                },
            };
            // Helper to process routes
            const processRoutes = (controller, prefix, allowedMethods) => {
                const routes = Reflect.getMetadata('routes', controller) || [];
                for (const route of routes) {
                    // Filter by allowed methods if specified (for Leafs)
                    if (allowedMethods && !allowedMethods.includes(route.methodName)) {
                        continue;
                    }
                    const fullPath = (prefix + route.path).replace(/:([a-zA-Z0-9_]+)/g, '{$1}'); // Convert /:id to /{id}
                    const method = route.requestMethod;
                    if (!openApiSpec.paths[fullPath]) {
                        openApiSpec.paths[fullPath] = {};
                    }
                    const operation = {
                        summary: route.methodName,
                        responses: {
                            '200': {
                                description: 'Success',
                            }
                        }
                    };
                    // Inspect metadata for Request Body (Yup Schema)
                    const yupSchema = Reflect.getMetadata('yup_form_schema', controller.prototype, route.methodName);
                    if (yupSchema) {
                        // Basic conversion of Yup to JSON Schema (simplified)
                        // In a real implementation this would be more robust or use a library
                        const description = yupSchema.describe();
                        operation.requestBody = {
                            content: {
                                'application/json': {
                                    schema: convertYupToOpenApi(description)
                                }
                            }
                        };
                    }
                    // Inspect metadata for Response (Sequelize Model)
                    const modelUsage = Reflect.getMetadata('model_usage', controller.prototype, route.methodName);
                    if (modelUsage) {
                        const { model, operation: op } = modelUsage;
                        const modelName = model.name;
                        // Add Schema if not exists
                        if (!openApiSpec.components.schemas[modelName]) {
                            openApiSpec.components.schemas[modelName] = convertSequelizeToOpenApi(model);
                        }
                        // Link response
                        if (op === 'findAll') {
                            operation.responses['200'].content = {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            status: { type: 'number', example: 200 },
                                            data: {
                                                type: 'array',
                                                items: { $ref: `#/components/schemas/${modelName}` }
                                            },
                                            count: { type: 'number' }
                                        }
                                    }
                                }
                            };
                        }
                        else {
                            // FindOne, Create, Update
                            operation.responses['200'].content = {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: {
                                            status: { type: 'number', example: 200 },
                                            data: { $ref: `#/components/schemas/${modelName}` }
                                        }
                                    }
                                }
                            };
                        }
                    }
                    // Parameters
                    const pathParams = fullPath.match(/{([a-zA-Z0-9_]+)}/g);
                    if (pathParams) {
                        operation.parameters = pathParams.map(p => ({
                            name: p.replace(/[{}]/g, ''),
                            in: 'path',
                            required: true,
                            schema: { type: 'string' }
                        }));
                    }
                    openApiSpec.paths[fullPath][method] = operation;
                }
            };
            // Process standard controllers
            for (const { controller } of controllers) {
                const ctrl = controller.default || controller;
                const prefix = Reflect.getMetadata('prefix', ctrl) || '';
                processRoutes(ctrl, prefix);
            }
            // Process leaf controllers
            for (const { controller, methods } of leafControllers) {
                const ctrl = controller.default || controller;
                const prefix = Reflect.getMetadata('prefix', ctrl) || '';
                processRoutes(ctrl, prefix, methods);
            }
            // Write file
            fs.writeFileSync(path.join(process.cwd(), 'openapi.json'), JSON.stringify(openApiSpec, null, 2));
            spinner.succeed('openapi.json generated successfully!');
        }
        catch (error) {
            spinner.fail('Failed to generate OpenAPI spec');
            console.error(chalk.red(error));
        }
    });
}
function findConfigFile(projectPath) {
    const possiblePaths = [
        path.join(projectPath, 'dist', 'Config.js'),
        path.join(projectPath, 'dist', 'src', 'Config.js'),
    ];
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}
function loadConfig(configPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const config = yield import(configPath);
        return config.default || config;
    });
}
// Helpers
function convertYupToOpenApi(description) {
    if (!description)
        return {};
    // Simplified conversion
    if (description.type === 'object') {
        const properties = {};
        const required = [];
        if (description.fields) {
            for (const key in description.fields) {
                properties[key] = convertYupToOpenApi(description.fields[key]);
                // if (description.fields[key].tests?.some((t: any) => t.name === 'required')) required.push(key)
            }
        }
        return {
            type: 'object',
            properties,
            // required
        };
    }
    if (description.type === 'string')
        return { type: 'string' };
    if (description.type === 'number')
        return { type: 'number' };
    if (description.type === 'boolean')
        return { type: 'boolean' };
    return { type: 'string' };
}
function convertSequelizeToOpenApi(model) {
    const properties = {};
    const rawAttributes = model.rawAttributes;
    for (const key in rawAttributes) {
        const attr = rawAttributes[key];
        let type = 'string';
        if (attr.type.constructor.name === 'INTEGER' || attr.type.key === 'INTEGER')
            type = 'number';
        if (attr.type.constructor.name === 'FLOAT' || attr.type.key === 'FLOAT')
            type = 'number';
        if (attr.type.constructor.name === 'BOOLEAN' || attr.type.key === 'BOOLEAN')
            type = 'boolean';
        if (attr.type.constructor.name === 'DATE' || attr.type.key === 'DATE')
            type = 'string'; // format: date-time
        properties[key] = { type };
    }
    return {
        type: 'object',
        properties
    };
}
