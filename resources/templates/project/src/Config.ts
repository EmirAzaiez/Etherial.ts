import * as path from 'path'
import { Dialect } from 'sequelize'

import App from './app'

import { Database, DatabaseConfig } from 'etherial/components/database'
import { Http, HttpConfig } from 'etherial/components/http'
import { HttpAuth, HttpAuthConfig } from 'etherial/components/http.auth'
import { Reactive, ReactiveConfig } from 'etherial/components/reactive'
// import { Translation, TranslationConfig } from 'etherial/components/translation'

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
            models: [path.join(__dirname, 'models')],
        } satisfies DatabaseConfig,
    },
    http: {
        module: Http,
        config: {
            port: parseInt(process.env.HTTP_PORT!),
            routes: [path.join(__dirname, 'routes')],
        } satisfies HttpConfig,
    },
    http_auth: {
        module: HttpAuth,
        config: {
            type: 'JWT',
            secret: process.env.HTTP_AUTH_SECRET!,
        } satisfies HttpAuthConfig,
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
