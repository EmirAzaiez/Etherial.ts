import express from "express";
import { Response, Request, RouteDefinition, NextFunction } from './provider'

const fs = require('fs').promises

export class Http {

    app: any;
    server: any;
    port: number
    routes: any
    notFoundRouteMiddleware: any

    constructor({port, routes, middlewares}) {
 
        this.app = express()

        this.port = port
        this.routes = routes
        this.notFoundRouteMiddleware = null

        if (middlewares && middlewares instanceof Array && middlewares.length > 0) {
            for (let middleware of middlewares) {
                this.app.use(middleware)
            }
        }

        this.app.use((req: Request, res: Response, next: NextFunction) => {

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

    listen() {

        return new Promise(async (resolve) => {

            let controllers = []

            for (let index = 0; index < this.routes.length; index++) {
                const route = this.routes[index];

                const stat = await fs.lstat(route)

                if (stat.isFile()) {
                    var controller =  require(route).default
                    controllers.push((controller))
                } else if (stat.isDirectory()) {

                    let routes = await fs.readdir(route)

                    for (let index = 0; index < routes.length; index++) {
                        var controller = require(`${route}/${routes[index]}`).default;
                        controllers.push((controller))
                    }

                }

            }

            controllers.forEach((controller) => {
                const instance = new controller();
                const prefix = Reflect.getMetadata('prefix', controller);
                const routes: Array<RouteDefinition> = Reflect.getMetadata('routes', controller);
                
                routes.forEach((route) => {

                    this.app[route.requestMethod](prefix + route.path, route.middlewares || [], (req: Request, res: Response, next: NextFunction) => {

                        let ret = instance[route.methodName](req, res, next);

                        if (ret != null && ret.then && typeof ret.then === 'function') {

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

                            } else {
                                res.error({status: 404, errors: ["not_found"]})
                            }
                            
                        })

                    }

                    });

                });

            });

            if (this.notFoundRouteMiddleware) {
                this.app.use(this.notFoundRouteMiddleware)
            }

            this.app.listen(this.port, () => {
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

}