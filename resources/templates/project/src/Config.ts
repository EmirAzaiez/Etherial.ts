import * as path from 'path'
import { Dialect } from 'sequelize'
import dotenv from 'dotenv'
import App from './app.js'
import { Database, DatabaseConfig } from 'etherial/components/database'
import { Http, HttpConfig } from 'etherial/components/http'
import { HttpAuth, HttpAuthConfig } from 'etherial/components/http.auth'
import { HttpSecurity, HttpSecurityConfig } from 'etherial/components/http.security'
import { Reactive, ReactiveConfig } from 'etherial/components/reactive'
// import { Translation, TranslationConfig } from 'etherial/components/translation'

dotenv.config()

declare module 'etherial' {
    interface Etherial {
    }
}

export default {
    app: {
        module: App,
    },

    database: {
        module: Database,
        config: {
            server: process.env.DATABASE_SERVER!,
            port: parseInt(process.env.DATABASE_PORT!),
            username: process.env.DATABASE_USERNAME!,
            password: process.env.DATABASE_PASSWORD!,
            name: process.env.DATABASE_NAME!,
            dialect: process.env.DATABASE_DIALECT! as Dialect,
            //@ts-ignore
            models: [path.join(__dirname, 'models')],
        } satisfies DatabaseConfig,
    },
    http: {
        module: Http,
        config: {
            port: parseInt(process.env.HTTP_PORT!),
            routes: [path.join(__dirname, 'routes')],
            bodyParser: {
                json: true,
            },

        } satisfies HttpConfig,
    },
    http_auth: {
        module: HttpAuth,
        config: {
            secret: process.env.HTTP_AUTH_SECRET!,
            defaultExpiresIn: process.env.HTTP_AUTH_EXPIRES_IN || '15m',
        } satisfies HttpAuthConfig,
    },
    http_security: {
        module: HttpSecurity,
        config: {
            // Honor X-Forwarded-For only when behind a trusted reverse proxy.
            // Defaults to false so attackers can't rotate the header to bypass
            // rate-limit / brute-force counters on a directly-exposed app.
            trustProxy: process.env.HTTP_TRUST_PROXY === 'true',
            rateLimit: {
                windowMs: 60_000,
                max: 300,
            },
            bruteForce: {
                freeRetries: 5,
                minWait: 1_000,
                maxWait: 15 * 60_000,
                lifetime: 60 * 60,
            },
        } satisfies HttpSecurityConfig,
    },
    reactive: {
        module: Reactive,
        config: {} satisfies ReactiveConfig,
    },
    // translation: {
    //     module: Translation,
    //     config: {
    //         defaultLanguage: 'fr-FR',
    //         translations: [require('../resources/translations/FR.json')],
    //     } satisfies TranslationConfig,
    // },
}
