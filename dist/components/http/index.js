var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express from 'express';
import http from 'http';
import { promises as fs } from 'fs';
import cors from 'cors';
import { createTranslationMiddleware } from '../translation/index.js';
export class Http {
    constructor(config) {
        this.routes_leafs = [];
        this.notFoundRouteMiddleware = null;
        this.errorHandler = null;
        this.registeredRoutes = [];
        this.validateConfig(config);
        this.config = config;
        this.app = express();
        this.port = config.port;
        this.log = this.setupLogging(config.logging);
        this.server = http.createServer(this.app);
        this.routes = config.routes;
        if (config.trustProxy) {
            this.app.set('trust proxy', config.trustProxy);
        }
        if (config.cors) {
            const corsOptions = typeof config.cors === 'boolean' ? {} : config.cors;
            this.app.use(cors(corsOptions));
        }
        this.setupBodyParsers(config.bodyParser);
        if (config.middlewares && config.middlewares.length > 0) {
            for (const middleware of config.middlewares) {
                this.app.use(middleware);
            }
        }
        this.app.use((req, res, next) => {
            res.success = (json) => {
                res.status(json.status || 200);
                res.json(json);
            };
            res.error = (json) => {
                res.status(json.status || 400);
                res.json(json);
            };
            next();
        });
    }
    validateConfig(config) {
        if (!config.port) {
            throw new Error('Http config missing required field: port');
        }
        if (!config.routes || !Array.isArray(config.routes)) {
            throw new Error('Http config missing required field: routes (must be an array)');
        }
        if (config.port < 0 || config.port > 65535) {
            throw new Error(`Invalid port number: ${config.port}. Must be between 0 and 65535`);
        }
        if (config.https) {
            if (!config.https.key || !config.https.cert) {
                throw new Error('HTTPS config requires both key and cert');
            }
        }
    }
    setupLogging(logging) {
        if (logging === false) {
            return () => { };
        }
        if (typeof logging === 'function') {
            return logging;
        }
        return (message) => console.log(`[Http] ${message}`);
    }
    setupBodyParsers(config) {
        const options = config !== null && config !== void 0 ? config : { json: true, urlencoded: true };
        if (options.json) {
            const jsonOptions = typeof options.json === 'object' ? options.json : {};
            this.app.use(express.json(jsonOptions));
        }
        if (options.urlencoded) {
            const urlencodedOptions = typeof options.urlencoded === 'object' ? options.urlencoded : { extended: true };
            this.app.use(express.urlencoded(urlencodedOptions));
        }
        if ('raw' in options && options.raw) {
            const rawOptions = typeof options.raw === 'object' ? options.raw : {};
            this.app.use(express.raw(rawOptions));
        }
    }
    loadControllers() {
        return __awaiter(this, void 0, void 0, function* () {
            const controllers = [];
            for (const routePath of this.routes) {
                try {
                    const stat = yield fs.lstat(routePath);
                    if (stat.isFile()) {
                        const module = yield import(routePath);
                        controllers.push({
                            route: routePath,
                            controller: module.default,
                        });
                    }
                    else if (stat.isDirectory()) {
                        const files = yield fs.readdir(routePath);
                        const imports = yield Promise.all(files.map((file) => __awaiter(this, void 0, void 0, function* () {
                            const filePath = `${routePath}/${file}`;
                            try {
                                const module = yield import(filePath);
                                return { route: filePath, controller: module.default };
                            }
                            catch (error) {
                                // Try appending .js if import failed
                                if (error.code === 'ERR_MODULE_NOT_FOUND' && !filePath.endsWith('.js')) {
                                    try {
                                        const module = yield import(filePath + '.js');
                                        return { route: filePath, controller: module.default };
                                    }
                                    catch (_a) {
                                        throw error; // Throw original error if retry fails
                                    }
                                }
                                throw error;
                            }
                        })));
                        controllers.push(...imports);
                    }
                }
                catch (error) {
                    // Try appending .js to the main routePath if it failed (e.g. if routePath was a file without extension)
                    // However, fs.lstat would have likely failed first if it didn't exist?
                    // Actually lstat works on paths without extension? No.
                    // The issue user reported was likely in the `loadLeafControllers` block or `this.routes` iteration where routePath is an import string from node_modules or similar?
                    this.log(`Warning: Could not load route ${routePath}: ${error.message}`);
                }
            }
            return controllers;
        });
    }
    loadLeafControllers() {
        return __awaiter(this, void 0, void 0, function* () {
            const controllers = [];
            console.log(2);
            for (const { route, methods } of this.routes_leafs) {
                console.log(3);
                try {
                    const module = yield import(route);
                    controllers.push({
                        controller: module.default,
                        methods,
                    });
                }
                catch (error) {
                    console.log(4);
                    console.log("ERRROR;", error);
                    // Retry with .js extension 
                    if (error.code === 'ERR_MODULE_NOT_FOUND' && !route.endsWith('.js')) {
                        try {
                            const module = yield import(route + '.js');
                            controllers.push({
                                controller: module.default,
                                methods,
                            });
                            continue;
                        }
                        catch (_a) {
                            // Fall through to error
                        }
                    }
                    this.log(`Warning: Could not load leaf route ${route}: ${error.message}`);
                }
            }
            return controllers;
        });
    }
    registerRoute(controller, route, instance, prefix) {
        const fullPath = prefix + route.path;
        this.app[route.requestMethod](fullPath, route.middlewares || [], (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const result = instance[route.methodName](req, res, next);
                if (result != null) {
                    if (result instanceof Array) {
                        res.success({ status: 200, data: result });
                    }
                    else if (result && typeof result.then === 'function') {
                        const resolved = yield result;
                        if (resolved !== undefined && resolved !== null) {
                            if (resolved instanceof Array) {
                                res.success({ status: 200, data: resolved });
                            }
                            else if ((_a = resolved._options) === null || _a === void 0 ? void 0 : _a.isNewRecord) {
                                res.success({ status: 201, data: resolved });
                            }
                            else {
                                res.success({ status: 200, data: resolved });
                            }
                        }
                    }
                }
            }
            catch (error) {
                next(error);
            }
        }));
        this.registeredRoutes.push({
            method: route.requestMethod,
            path: fullPath,
            handler: `${controller.name}.${route.methodName}`,
        });
    }
    setupHealthcheckRoute() {
        var _a;
        const healthcheckConfig = this.config.healthcheck;
        if (healthcheckConfig === false) {
            return;
        }
        const path = typeof healthcheckConfig === 'object' ? (_a = healthcheckConfig.path) !== null && _a !== void 0 ? _a : '/healthcheck' : '/healthcheck';
        this.app.get(path, (_req, res) => {
            var _a;
            (_a = res.success) === null || _a === void 0 ? void 0 : _a.call(res, {
                status: 200,
                data: {
                    uptime: process.uptime(),
                    message: 'OK',
                    timestamp: Date.now(),
                },
            });
        });
        this.registeredRoutes.push({
            method: 'get',
            path,
            handler: 'Etherial.healthcheck',
        });
        this.log(`Healthcheck route registered: GET ${path}`);
    }
    listen() {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            // Load and register controllers
            const controllers = yield this.loadControllers();
            for (const { controller, route } of controllers) {
                try {
                    const ctrl = controller.default || controller;
                    const instance = new ctrl();
                    const prefix = Reflect.getMetadata('prefix', ctrl) || '';
                    const routes = Reflect.getMetadata('routes', ctrl) || [];
                    for (const routeDef of routes) {
                        this.registerRoute(ctrl, routeDef, instance, prefix);
                    }
                }
                catch (error) {
                    throw new Error(`Error loading ${route}. Ensure your controller follows Etherial Http conventions: ${error.message}`);
                }
            }
            this.setupHealthcheckRoute();
            for (const { route, methods } of this.routes_leafs) {
                try {
                    const module = yield import(route);
                    const controller = module.default;
                    const instance = new controller();
                    const prefix = Reflect.getMetadata('prefix', controller) || '';
                    const routes = Reflect.getMetadata('routes', controller) || [];
                    for (const routeDef of routes) {
                        if (methods.includes(routeDef.methodName)) {
                            this.registerRoute(controller, routeDef, instance, prefix);
                        }
                    }
                }
                catch (error) {
                    this.log(`Warning: Could not load leaf route ${route}: ${error.message}`);
                }
            }
            // 404 handler
            if (this.notFoundRouteMiddleware) {
                this.app.use(this.notFoundRouteMiddleware);
            }
            else {
                this.app.use((req, res) => {
                    res.status(404).json({
                        status: 404,
                        error: 'Not Found',
                        message: `Route ${req.method} ${req.path} not found`,
                    });
                });
            }
            // Error handler
            if (this.errorHandler) {
                this.app.use(this.errorHandler);
            }
            else {
                this.app.use(((err, req, res, _next) => {
                    this.log(`Error: ${err.message}`);
                    res.status(500).json({
                        status: 500,
                        error: 'Internal Server Error',
                        message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
                    });
                }));
            }
            // Start server
            return new Promise((resolve, reject) => {
                var _a;
                const host = (_a = this.config.host) !== null && _a !== void 0 ? _a : '0.0.0.0';
                this.server.listen(this.port, host, () => {
                    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                    const protocol = this.config.https ? 'https' : 'http';
                    this.log(`Server started in ${duration}s`);
                    this.log(`Listening on ${protocol}://${host}:${this.port}`);
                    this.log(`${this.registeredRoutes.length} routes registered`);
                    resolve(this);
                });
                this.server.on('error', (error) => {
                    if (error.code === 'EADDRINUSE') {
                        reject(new Error(`Port ${this.port} is already in use`));
                    }
                    else {
                        reject(error);
                    }
                });
            });
        });
    }
    addRoutes(routes) {
        if (Array.isArray(routes)) {
            this.routes = [...this.routes, ...routes];
        }
        else {
            this.routes = [...this.routes, routes];
        }
        return this;
    }
    notFoundRoute(middleware) {
        this.notFoundRouteMiddleware = middleware;
        return this;
    }
    onError(handler) {
        this.errorHandler = handler;
        return this;
    }
    use(middleware) {
        this.app.use(middleware);
        return this;
    }
    beforeRun() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const route of this.routes) {
                try {
                    yield fs.access(route);
                }
                catch (_a) {
                    this.log(`Warning: Route path does not exist: ${route}`);
                }
            }
        });
    }
    run(etherial) {
        return __awaiter(this, void 0, void 0, function* () {
            if (etherial === null || etherial === void 0 ? void 0 : etherial.translation) {
                this.app.use(createTranslationMiddleware(etherial.translation));
                this.log('Translation middleware integrated');
            }
            // return this
        });
    }
    afterRun() {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    getRegisteredRoutes() {
        return [...this.registeredRoutes];
    }
    commands() {
        return [
            {
                command: 'routes',
                description: 'List all registered routes',
                warn: false,
                action: () => __awaiter(this, void 0, void 0, function* () {
                    const routes = this.getRegisteredRoutes();
                    const formatted = routes
                        .map((r) => `${r.method.toUpperCase().padEnd(7)} ${r.path} → ${r.handler}`)
                        .join('\n');
                    return {
                        success: true,
                        message: routes.length > 0 ? `Registered routes:\n${formatted}` : 'No routes registered',
                    };
                }),
            },
        ];
    }
}
