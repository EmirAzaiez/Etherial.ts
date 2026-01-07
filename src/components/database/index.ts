import { Sequelize, SequelizeOptions, ModelCtor, Model } from 'sequelize-typescript'
import * as sequelizeFixtures from 'sequelize-fixtures'
import { IEtherialModule } from '../../index.js'
import { Dialect } from 'sequelize'

export type LoggingFunction = (sql: string, timing?: number) => void

export interface DatabaseConfig {
    server: string
    port: number
    name: string
    username: string
    password: string
    dialect: Dialect
    models?: (ModelCtor<Model> | string)[]

    logging?: boolean | LoggingFunction
    storage?: string
    ssl?: boolean | { rejectUnauthorized?: boolean }
    define?: {
        underscored?: boolean
        timestamps?: boolean
        paranoid?: boolean
        freezeTableName?: boolean
    }
    timezone?: string
}

export class Database implements IEtherialModule {
    models: (ModelCtor<Model> | string)[] = []
    sequelize: Sequelize
    private config: DatabaseConfig

    constructor(config: DatabaseConfig) {
        this.validateConfig(config)
        this.config = config

        const sequelizeOptions: SequelizeOptions = {
            host: config.server,
            port: config.port,
            database: config.name,
            dialect: config.dialect,
            username: config.username,
            password: config.password,
            logging: config.logging ?? false,
            define: {
                underscored: config.define?.underscored ?? true,
                timestamps: config.define?.timestamps ?? true,
                paranoid: config.define?.paranoid ?? false,
                freezeTableName: config.define?.freezeTableName ?? false,
            },
            timezone: config.timezone ?? '+00:00',
        }

        if (config.dialect === 'sqlite') {
            sequelizeOptions.storage = config.storage ?? ':memory:'
        }

        if (config.ssl) {
            sequelizeOptions.dialectOptions = {
                ssl:
                    typeof config.ssl === 'boolean'
                        ? { rejectUnauthorized: false }
                        : config.ssl,
            }
        }

        this.sequelize = new Sequelize(sequelizeOptions)

        if (config.models) {
            this.models = config.models
        }
    }

    private validateConfig(config: DatabaseConfig): void {
        const required: (keyof DatabaseConfig)[] = ['server', 'port', 'name', 'username', 'password', 'dialect']
        const missing = required.filter((key) => config[key] === undefined || config[key] === null)

        if (missing.length > 0) {
            throw new Error(`Database config missing required fields: ${missing.join(', ')}`)
        }

        const validDialects: Dialect[] = ['mysql', 'postgres', 'sqlite', 'mariadb', 'mssql']
        if (!validDialects.includes(config.dialect)) {
            throw new Error(`Invalid dialect "${config.dialect}". Must be one of: ${validDialects.join(', ')}`)
        }
    }

    async beforeRun(): Promise<void> { }

    async run(): Promise<void> {
        if (this.models.length > 0) {
            this.sequelize.addModels(this.models)
        }
        await this.sequelize.sync()
    }

    addModels(models: ModelCtor<Model>[]): void {
        this.models = [...this.models, ...models]
    }

    async sync(options?: { force?: boolean; alter?: boolean }): Promise<void> {
        await this.sequelize.sync(options)
    }

    async transaction<T>(callback: (t: any) => Promise<T>): Promise<T> {
        return await this.sequelize.transaction(callback)
    }

    commands() {
        return [
            {
                command: 'destroy',
                description: 'Destroy database and recreate it (⚠️ DESTRUCTIVE)',
                warn: true,
                action: async () => {
                    try {
                        await this.run()
                        await this.sequelize.sync({ force: true })
                        return { success: true, message: 'Database destroyed and recreated successfully.' }
                    } catch (error) {
                        return { success: false, message: (error as Error).message }
                    }
                },
            },
            {
                command: 'migrate',
                description: 'Run pending migrations (alter mode)',
                warn: true,
                action: async () => {
                    try {
                        await this.run()
                        await this.sequelize.sync({ alter: true })
                        return { success: true, message: 'Migrations applied successfully.' }
                    } catch (error) {
                        return { success: false, message: (error as Error).message }
                    }
                },
            },
            {
                command: 'load:fixtures <env>',
                description: 'Load fixtures (⚠️ destroys existing data)',
                warn: true,
                action: async (_etherial: any, env: string) => {
                    try {
                        await this.run()
                        await this.sequelize.sync({ force: true })
                        const fixturePath = `${process.cwd()}/fixtures/${env}.json`
                        await sequelizeFixtures.loadFile(fixturePath, this.sequelize.models)
                        return { success: true, message: `Fixtures from ${env}.json loaded successfully.` }
                    } catch (error) {
                        return { success: false, message: (error as Error).message }
                    }
                },
            }
        ]
    }
}
