import { IEtherialModule, IEtherial } from '../../index.js'
import expressLayouts from 'express-ejs-layouts'

export interface HttpFrontConfig {
    viewsFolder?: string
    defaultLayout?: string
    viewEngine?: 'ejs' | 'pug' | 'hbs'
    logging?: boolean | ((message: string) => void)
}

export class HttpFront implements IEtherialModule {
    private config: HttpFrontConfig
    private log: (message: string) => void

    constructor(config: HttpFrontConfig = {}) {
        this.config = {
            viewEngine: 'ejs',
            ...config,
        }

        this.log = this.setupLogging(config.logging)
    }

    private setupLogging(logging?: boolean | ((message: string) => void)): (message: string) => void {
        if (logging === false) {
            return () => { }
        }
        if (typeof logging === 'function') {
            return logging
        }
        return (message: string) => console.log(`[HttpFront] ${message}`)
    }

    async beforeRun(): Promise<void> { }

    async run({ http }: IEtherial): Promise<void> {
        if (!http) {
            throw new Error('HttpFront requires the Http module to be registered first.')
        }

        http.app.use(expressLayouts)
        http.app.set('view engine', this.config.viewEngine)

        if (this.config.viewsFolder) {
            http.app.set('views', this.config.viewsFolder)
            this.log(`Views folder set to: ${this.config.viewsFolder}`)
        }

        if (this.config.defaultLayout) {
            http.app.set('layout', this.config.defaultLayout)
            this.log(`Default layout set to: ${this.config.defaultLayout}`)
        }

        this.log(`View engine configured: ${this.config.viewEngine}`)
    }

    async afterRun(): Promise<void> { }

    commands() {
        return []
    }
}
