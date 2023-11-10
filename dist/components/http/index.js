"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Http = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const doc_generator_1 = __importDefault(require("./doc:generator"));
const fs = require('fs').promises;
class Http {
    constructor({ port, routes, middlewares }) {
        this.etherial_module_name = 'http';
        this.app = (0, express_1.default)();
        this.server = http_1.default.createServer(this.app);
        this.port = port;
        this.routes = routes;
        this.notFoundRouteMiddleware = null;
        if (middlewares && middlewares instanceof Array && middlewares.length > 0) {
            for (let middleware of middlewares) {
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
    initAdminJS(config, rootPath = "/admin") {
        return __awaiter(this, void 0, void 0, function* () {
            let { AdminJS, ComponentLoader } = yield import("adminjs");
            let AdminJSExpress = yield import("@adminjs/express");
            let AdminJSSequelize = yield import("@adminjs/sequelize");
            AdminJS.registerAdapter({
                Resource: AdminJSSequelize.Resource,
                Database: AdminJSSequelize.Database,
            });
            const admin = new AdminJS(yield config(AdminJS, ComponentLoader));
            const adminRouter = AdminJSExpress.buildRouter(admin);
            this.app.use(rootPath, adminRouter);
        });
    }
    listen() {
        return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
            let controllers = [];
            for (let index = 0; index < this.routes.length; index++) {
                const route = this.routes[index];
                const stat = yield fs.lstat(route);
                if (stat.isFile()) {
                    var controller = require(route).default;
                    controllers.push((controller));
                    controllers = [...controllers, {
                            route: `route`,
                            controller: require(route).default
                        }];
                }
                else if (stat.isDirectory()) {
                    let routes = yield fs.readdir(route);
                    let promises = [];
                    for (let index = 0; index < routes.length; index++) {
                        const filePath = `${route}/${routes[index]}`;
                        controllers = [...controllers, {
                                route: filePath,
                                // controller: (await import(filePath)).default
                            }];
                        promises.push(import(filePath));
                    }
                    const begin = Date.now();
                    yield Promise.all(promises).then((pro) => {
                        console.log(`Runing http module in ${(Date.now() - begin) / 1000 + "s"}`);
                        pro.map((a, i) => {
                            controllers[i].controller = a.default;
                        });
                    });
                }
            }
            controllers.forEach(({ controller, route }) => {
                try {
                    controller = controller.default;
                    const instance = new controller();
                    const prefix = Reflect.getMetadata('prefix', controller);
                    const routes = Reflect.getMetadata('routes', controller);
                    routes.forEach((route) => {
                        this.app[route.requestMethod](prefix + route.path, route.middlewares || [], (req, res, next) => {
                            let ret = instance[route.methodName](req, res, next);
                            if (ret != null && ret instanceof Array) {
                                res.success({ status: 200, data: ret });
                            }
                            else if (ret != null && ret.then && typeof ret.then === 'function') {
                                ret.then((el) => {
                                    if (el) {
                                        if (el instanceof Array) {
                                            res.success({ status: 200, data: el });
                                        }
                                        else {
                                            if (el._options && el._options.isNewRecord) {
                                                res.success({ status: 201, data: el });
                                            }
                                            else {
                                                res.success({ status: 200, data: el });
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    });
                }
                catch (e) {
                    throw new Error(`Error when loading ${route}. Please be sure your controller respect the Etherial Http Norm.`);
                }
            });
            if (this.notFoundRouteMiddleware) {
                this.app.use(this.notFoundRouteMiddleware);
            }
            this.server.listen(this.port, () => {
                resolve(this);
            });
        }));
    }
    addRoutes(routes) {
        if (routes instanceof Array) {
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
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            return this;
        });
    }
    commands() {
        return [{
                command: 'generate:documentation',
                description: 'Generate a full Swagger documentation.',
                warn: false,
                action: (etherial) => __awaiter(this, void 0, void 0, function* () {
                    // @ts-ignore
                    // console.log(sjs.getSequelizeSchema(etherial.database.sequelize))
                    let rtn = (0, doc_generator_1.default)(etherial);
                    fs.writeFile(`${process.cwd()}/doc.json`, JSON.stringify(rtn, null, 4), (err) => { });
                    return { success: true, message: 'Http server destroyed successfully.' };
                })
            }, {
                command: 'generate:rtk-query',
                description: 'Generate a full Swagger documentation.',
                warn: false,
                action: (etherial) => __awaiter(this, void 0, void 0, function* () {
                    let rtn = (0, doc_generator_1.default)(etherial);
                    fs.writeFile(`${process.cwd()}/doc.json`, JSON.stringify(rtn, null, 4), (err) => { });
                    return { success: true, message: 'Http server destroyed successfully.' };
                })
            }];
    }
}
exports.Http = Http;
//# sourceMappingURL=index.js.map