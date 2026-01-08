import express, { RequestHandler, ErrorRequestHandler } from 'express'
import { RouteDefinition, Response, Request, NextFunction } from './provider.js'
import http from 'http'
import https from 'https'
import { promises as fs } from 'fs'
import cors, { CorsOptions } from 'cors'

import { IEtherialModule, IEtherial } from '../../index.js'
import { Translation, createTranslationMiddleware } from '../translation/index.js'

export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head' | 'all'

export interface HttpConfig {
    port: number
    routes: string[]
    middlewares?: RequestHandler[]

    // Options avancées
    host?: string
    https?: {
        key: string | Buffer
        cert: string | Buffer
        passphrase?: string
    }
    cors?: boolean | CorsOptions
    bodyParser?: {
        json?: boolean | { limit?: string }
        urlencoded?: boolean | { extended?: boolean; limit?: string }
        raw?: boolean | { limit?: string }
    }
    trustProxy?: boolean | string | number
    logging?: boolean | ((message: string) => void)
    healthcheck?: boolean | {
        path?: string
    }
}

export interface ServerInfo {
    host: string
    port: number
    protocol: 'http' | 'https'
    url: string
    routeCount: number
}

export class Http implements IEtherialModule {
    app: express.Application
    server: http.Server | https.Server
    port: number
    routes: string[]
    routes_leafs: { route: string; methods: string[] }[] = []
    notFoundRouteMiddleware: RequestHandler | null = null
    errorHandler: ErrorRequestHandler | null = null

    private config: HttpConfig
    private registeredRoutes: { method: HttpMethod; path: string; handler: string }[] = []
    private log: (message: string) => void

    constructor(config: HttpConfig) {
        this.validateConfig(config)
        this.config = config

        this.app = express()
        this.port = config.port

        this.log = this.setupLogging(config.logging)


        this.server = http.createServer(this.app)

        this.routes = config.routes

        if (config.trustProxy) {
            this.app.set('trust proxy', config.trustProxy)
        }

        if (config.cors) {
            const corsOptions = typeof config.cors === 'boolean' ? {} : config.cors
            this.app.use(cors(corsOptions))
        }

        this.setupBodyParsers(config.bodyParser)

        if (config.middlewares && config.middlewares.length > 0) {
            for (const middleware of config.middlewares) {
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

    private validateConfig(config: HttpConfig): void {
        if (!config.port) {
            throw new Error('Http config missing required field: port')
        }

        if (!config.routes || !Array.isArray(config.routes)) {
            throw new Error('Http config missing required field: routes (must be an array)')
        }

        if (config.port < 0 || config.port > 65535) {
            throw new Error(`Invalid port number: ${config.port}. Must be between 0 and 65535`)
        }

        if (config.https) {
            if (!config.https.key || !config.https.cert) {
                throw new Error('HTTPS config requires both key and cert')
            }
        }
    }

    private setupLogging(logging?: boolean | ((message: string) => void)): (message: string) => void {
        if (logging === false) {
            return () => { }
        }
        if (typeof logging === 'function') {
            return logging
        }
        return (message: string) => console.log(`[Http] ${message}`)
    }

    private setupBodyParsers(config?: HttpConfig['bodyParser']): void {
        const options = config ?? { json: true, urlencoded: true }

        if (options.json) {
            const jsonOptions = typeof options.json === 'object' ? options.json : {}
            this.app.use(express.json(jsonOptions))
        }

        if (options.urlencoded) {
            const urlencodedOptions =
                typeof options.urlencoded === 'object' ? options.urlencoded : { extended: true }
            this.app.use(express.urlencoded(urlencodedOptions))
        }

        if ('raw' in options && options.raw) {
            const rawOptions = typeof options.raw === 'object' ? options.raw : {}
            this.app.use(express.raw(rawOptions))
        }
    }

    public async loadControllers(): Promise<{ route: string; controller: any }[]> {
        const controllers: { route: string; controller: any }[] = []

        for (const routePath of this.routes) {
            try {
                const stat = await fs.lstat(routePath)

                if (stat.isFile()) {
                    const module = await import(routePath)
                    controllers.push({
                        route: routePath,
                        controller: module.default,
                    })
                } else if (stat.isDirectory()) {
                    const files = await fs.readdir(routePath)
                    const imports = await Promise.all(
                        files.map(async (file) => {
                            const filePath = `${routePath}/${file}`
                            try {
                                const module = await import(filePath)
                                return { route: filePath, controller: module.default }
                            } catch (error: any) {
                                // Try appending .js if import failed
                                if (error.code === 'ERR_MODULE_NOT_FOUND' && !filePath.endsWith('.js')) {
                                    try {
                                        const module = await import(filePath + '.js')
                                        return { route: filePath, controller: module.default }
                                    } catch {
                                        throw error // Throw original error if retry fails
                                    }
                                }
                                throw error
                            }
                        })
                    )
                    controllers.push(...imports)
                }
            } catch (error) {
                // Try appending .js to the main routePath if it failed (e.g. if routePath was a file without extension)
                // However, fs.lstat would have likely failed first if it didn't exist?
                // Actually lstat works on paths without extension? No.
                // The issue user reported was likely in the `loadLeafControllers` block or `this.routes` iteration where routePath is an import string from node_modules or similar?

                this.log(`Warning: Could not load route ${routePath}: ${(error as Error).message}`)
            }
        }

        return controllers
    }

    public async loadLeafControllers(): Promise<{ controller: any; methods: string[] }[]> {
        const controllers: { controller: any; methods: string[] }[] = []


        for (const { route, methods } of this.routes_leafs) {
            try {
                const module = await import(route)
                controllers.push({
                    controller: module.default,
                    methods,
                })
            } catch (error: any) {
                // Retry with .js extension 
                if (error.code === 'ERR_MODULE_NOT_FOUND' && !route.endsWith('.js')) {
                    try {
                        const module = await import(route + '.js')
                        controllers.push({
                            controller: module.default,
                            methods,
                        })
                        continue
                    } catch {
                        // Fall through to error
                    }
                }
                this.log(`Warning: Could not load leaf route ${route}: ${(error as Error).message}`)
            }
        }

        return controllers
    }

    private registerRoute(
        controller: any,
        route: RouteDefinition,
        instance: any,
        prefix: string
    ): void {
        const fullPath = prefix + route.path

        this.app[route.requestMethod](
            fullPath,
            route.middlewares || [],
            async (req: Request, res: Response, next: NextFunction) => {
                try {
                    const result = instance[route.methodName](req, res, next)

                    if (result != null) {
                        if (result instanceof Array) {
                            res.success({ status: 200, data: result })
                        } else if (result && typeof result.then === 'function') {
                            const resolved = await result

                            if (resolved !== undefined && resolved !== null) {
                                if (resolved instanceof Array) {
                                    res.success({ status: 200, data: resolved })
                                } else if (resolved._options?.isNewRecord) {
                                    res.success({ status: 201, data: resolved })
                                } else {
                                    res.success({ status: 200, data: resolved })
                                }
                            }
                        }
                    }
                } catch (error) {
                    next(error)
                }
            }
        )

        this.registeredRoutes.push({
            method: route.requestMethod,
            path: fullPath,
            handler: `${controller.name}.${route.methodName}`,
        })
    }

    private setupHealthcheckRoute(): void {
        const healthcheckConfig = this.config.healthcheck
        if (healthcheckConfig === false) {
            return
        }

        const path = typeof healthcheckConfig === 'object' ? healthcheckConfig.path ?? '/healthcheck' : '/healthcheck'

        this.app.get(path, (_req: Request, res: Response) => {
            res.success?.({
                status: 200,
                data: {
                    uptime: process.uptime(),
                    message: 'OK',
                    timestamp: Date.now(),
                },
            })
        })

        this.registeredRoutes.push({
            method: 'get',
            path,
            handler: 'Etherial.healthcheck',
        })

        this.log(`Healthcheck route registered: GET ${path}`)
    }

    async listen(): Promise<this> {
        const startTime = Date.now()

        // Load and register controllers
        const controllers = await this.loadControllers()

        for (const { controller, route } of controllers) {
            try {
                const ctrl = controller.default || controller
                const instance = new ctrl()
                const prefix = Reflect.getMetadata('prefix', ctrl) || ''
                const routes: RouteDefinition[] = Reflect.getMetadata('routes', ctrl) || []

                for (const routeDef of routes) {
                    this.registerRoute(ctrl, routeDef, instance, prefix)
                }
            } catch (error) {
                throw new Error(
                    `Error loading ${route}. Ensure your controller follows Etherial Http conventions: ${(error as Error).message}`
                )
            }
        }

        this.setupHealthcheckRoute()

        for (const { route, methods } of this.routes_leafs) {
            try {
                const module = await import(route)
                const controller = module.default
                const instance = new controller()
                const prefix = Reflect.getMetadata('prefix', controller) || ''
                const routes: RouteDefinition[] = Reflect.getMetadata('routes', controller) || []

                for (const routeDef of routes) {
                    if (methods.includes(routeDef.methodName)) {
                        this.registerRoute(controller, routeDef, instance, prefix)
                    }
                }
            } catch (error) {
                this.log(`Warning: Could not load leaf route ${route}: ${(error as Error).message}`)
            }
        }

        // 404 handler
        if (this.notFoundRouteMiddleware) {
            this.app.use(this.notFoundRouteMiddleware)
        } else {
            this.app.use((req: Request, res: Response) => {
                res.status(404).json({
                    status: 404,
                    error: 'Not Found',
                    message: `Route ${req.method} ${req.path} not found`,
                })
            })
        }

        // Error handler
        if (this.errorHandler) {
            this.app.use(this.errorHandler)
        } else {
            this.app.use(((err: Error, req: Request, res: Response, _next: NextFunction) => {
                this.log(`Error: ${err.message}`)
                res.status(500).json({
                    status: 500,
                    error: 'Internal Server Error',
                    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
                })
            }) as ErrorRequestHandler)
        }

        // Start server
        return new Promise((resolve, reject) => {
            const host = this.config.host ?? '0.0.0.0'

            this.server.listen(this.port, host, () => {
                const duration = ((Date.now() - startTime) / 1000).toFixed(2)
                const protocol = this.config.https ? 'https' : 'http'

                this.log(`Server started in ${duration}s`)
                this.log(`Listening on ${protocol}://${host}:${this.port}`)
                this.log(`${this.registeredRoutes.length} routes registered`)

                resolve(this)
            })

            this.server.on('error', (error: NodeJS.ErrnoException) => {
                if (error.code === 'EADDRINUSE') {
                    reject(new Error(`Port ${this.port} is already in use`))
                } else {
                    reject(error)
                }
            })
        })
    }

    addRoutes(routes: string | string[]): this {
        if (Array.isArray(routes)) {
            this.routes = [...this.routes, ...routes]
        } else {
            this.routes = [...this.routes, routes]
        }
        return this
    }

    notFoundRoute(middleware: RequestHandler): this {
        this.notFoundRouteMiddleware = middleware
        return this
    }

    onError(handler: ErrorRequestHandler): this {
        this.errorHandler = handler
        return this
    }

    use(middleware: RequestHandler): this {
        this.app.use(middleware)
        return this
    }

    async beforeRun(): Promise<void> {
        for (const route of this.routes) {
            try {
                await fs.access(route)
            } catch {
                this.log(`Warning: Route path does not exist: ${route}`)
            }
        }
    }

    async run(etherial?: IEtherial): Promise<void> {
        if (etherial?.translation) {
            this.app.use(createTranslationMiddleware(etherial.translation))
            this.log('Translation middleware integrated')
        }

        // return this
    }

    async afterRun(): Promise<void> {
    }

    getRegisteredRoutes(): { method: HttpMethod; path: string; handler: string }[] {
        return [...this.registeredRoutes]
    }


    commands() {
        return [
            {
                command: 'routes',
                description: 'List all registered routes',
                warn: false,
                action: async () => {
                    const routes = this.getRegisteredRoutes()
                    const formatted = routes
                        .map((r) => `${r.method.toUpperCase().padEnd(7)} ${r.path} → ${r.handler}`)
                        .join('\n')
                    return {
                        success: true,
                        message: routes.length > 0 ? `Registered routes:\n${formatted}` : 'No routes registered',
                    }
                },
            },
        ]
    }
}
