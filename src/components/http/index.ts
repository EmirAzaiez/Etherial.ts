import express from "express";
import { RouteDefinition, Response, Request, NextFunction } from './provider'
import http from "http"

import { IEtherialModule } from "../../index"

import docGenerator from "./doc:generator"

const fs = require('fs').promises

export class Http implements IEtherialModule {

    etherial_module_name: string = 'http'

    app: express.Application;
    server: http.Server;
    port: number;
    routes: any;
    notFoundRouteMiddleware: any;

    constructor({port, routes, middlewares}) {
 
        this.app = express()

        this.server = http.createServer(this.app);

        this.port = port
        this.routes = routes
        this.notFoundRouteMiddleware = null

        if (middlewares && middlewares instanceof Array && middlewares.length > 0) {
            for (let middleware of middlewares) {
                this.app.use(middleware)
            }
        }

        this.app.use((req, res, next) => {

            res.success = (json) => {
                res.status(json.status || 200)
                res.json(json)
            }

            res.error = (json) => {
                res.status(json.status || 400)
                res.json(json)
            }

            next()
    
        })

    }

    async initAdminJS(config, rootPath = "/admin") {

        let { AdminJS, ComponentLoader } = await import("adminjs");
        let AdminJSExpress = await import("@adminjs/express");
        let AdminJSSequelize = await import("@adminjs/sequelize");

        AdminJS.registerAdapter({
            Resource: AdminJSSequelize.Resource,
            Database: AdminJSSequelize.Database,
        })
        
        const admin = new AdminJS(await config(AdminJS, ComponentLoader))

        const adminRouter = AdminJSExpress.buildRouter(admin)
        this.app.use(rootPath, adminRouter)

    }

    listen() {

        return new Promise(async (resolve) => {

            let controllers = []

            for (let index = 0; index < this.routes.length; index++) {
                const route = this.routes[index];

                const stat = await fs.lstat(route)

                if (stat.isFile()) {
                    var controller =  require(route).default
                    controllers.push((controller))

                    controllers = [...controllers, {
                        route: `route`,
                        controller: require(route).default
                    }]

                } else if (stat.isDirectory()) {

                    let routes = await fs.readdir(route)
                    let promises = []

                    for (let index = 0; index < routes.length; index++) {
                        const filePath = `${route}/${routes[index]}`;

                        controllers = [...controllers, {
                            route: filePath,
                            // controller: (await import(filePath)).default
                        }]

                        promises.push(import(filePath))

                    }

                    const begin = Date.now();

                    await Promise.all(promises).then((pro) => {
                        console.log(`Runing http module in ${(Date.now() - begin) / 1000 + "s"}`);

                        pro.map((a, i) => {
                            controllers[i].controller = a.default
                        })
                    })

                }

            }

            controllers.forEach(({ controller, route }) => {

                try {

                    controller = controller.default

                    const instance = new controller();

                    const prefix = Reflect.getMetadata('prefix', controller);

                    const routes: Array<RouteDefinition> = Reflect.getMetadata('routes', controller);
                    
                    routes.forEach((route) => {

                        this.app[route.requestMethod](prefix + route.path, route.middlewares || [], (req: Request, res: Response, next: NextFunction) => {
                            
                            let ret = instance[route.methodName](req, res, next);

                            if (ret != null && ret instanceof Array) {
                            
                                res.success({status: 200, data: ret})

                            } else if (ret != null && ret.then && typeof ret.then === 'function') {

                                ret.then((el) => {

                                    if (el) {

                                        if (el instanceof Array) {

                                            res.success({status: 200, data: el})

                                        } else {

                                            if (el._options && el._options.isNewRecord) {
                                                res.success({status: 201, data: el})
                                            } else {
                                                res.success({status: 200, data: el})
                                            }

                                        }

                                    }
                                    
                                })

                            }

                        });

                    });

                } catch (e) {
                    throw new Error(`Error when loading ${route}. Please be sure your controller respect the Etherial Http Norm.`)
                }

            });

            if (this.notFoundRouteMiddleware) {
                this.app.use(this.notFoundRouteMiddleware)
            }

            this.server.listen(this.port, () => {
                resolve(this)
            })

        })
    }

    addRoutes(routes) {

        if (routes instanceof Array) {
            this.routes = [...this.routes, ...routes]    
        } else {
            this.routes = [...this.routes, routes]    
        }

        return this
    }

    notFoundRoute(middleware) {
        this.notFoundRouteMiddleware = middleware
        return this
    }

    async run() {
        return this
    }

    commands() {

        return [{
            command: 'generate:documentation',
            description: 'Generate a full Swagger documentation.',
            warn: false,
            action: async (etherial) => {

                // @ts-ignore
                // console.log(sjs.getSequelizeSchema(etherial.database.sequelize))

                let rtn = docGenerator(etherial)

                fs.writeFile(`${process.cwd()}/doc.json`, JSON.stringify(rtn, null, 4), (err) => { })

                return { success: true, message: 'Http server destroyed successfully.' }

            }
        }, {
            command: 'generate:rtk-query',
            description: 'Generate a full Swagger documentation.',
            warn: false,
            action: async (etherial) => {

                let rtn = docGenerator(etherial)

                fs.writeFile(`${process.cwd()}/doc.json`, JSON.stringify(rtn, null, 4), (err) => { })

                return { success: true, message: 'Http server destroyed successfully.' }

            }
        }]

    }

}