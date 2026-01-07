import knex, { Knex } from 'knex'
import { IEtherialModule } from '../../index.js'

type RawSQLDialect = 'mysql' | 'mysql2' | 'pg' | 'sqlite3' | 'mssql' | 'oracledb'

export interface RawSQLConfig {
    server: string
    port: number
    name: string
    username: string
    password: string
    dialect: RawSQLDialect
    pool?: {
        min?: number
        max?: number
    }
    ssl?: boolean | { rejectUnauthorized?: boolean }
}

export class RawSQL implements IEtherialModule {
    private config: RawSQLConfig
    knex: Knex

    constructor(config: RawSQLConfig) {
        this.validateConfig(config)
        this.config = config

        const connectionConfig: Record<string, any> = {
            host: config.server,
            port: config.port,
            user: config.username,
            password: config.password,
            database: config.name,
        }

        if (config.ssl) {
            connectionConfig.ssl =
                typeof config.ssl === 'boolean'
                    ? { rejectUnauthorized: false }
                    : config.ssl
        }

        this.knex = knex({
            client: config.dialect,
            connection: connectionConfig,
            pool: config.pool ?? { min: 0, max: 10 },
        })
    }

    private validateConfig(config: RawSQLConfig): void {
        const required: (keyof RawSQLConfig)[] = [
            'server',
            'port',
            'name',
            'username',
            'password',
            'dialect',
        ]
        const missing = required.filter(
            (key) => config[key] === undefined || config[key] === null
        )

        if (missing.length > 0) {
            throw new Error(
                `RawSQL config missing required fields: ${missing.join(', ')}`
            )
        }

        const validDialects: RawSQLDialect[] = [
            'mysql',
            'mysql2',
            'pg',
            'sqlite3',
            'mssql',
            'oracledb',
        ]
        if (!validDialects.includes(config.dialect)) {
            throw new Error(
                `Invalid dialect "${config.dialect}". Must be one of: ${validDialects.join(', ')}`
            )
        }
    }

    /**
     * Execute a raw SQL query
     */
    async raw<T = any>(sql: string, bindings?: readonly Knex.RawBinding[]): Promise<T> {
        const result = await this.knex.raw(sql, bindings as any)
        return result as T
    }

    /**
     * Start a query on a specific table
     */
    table<T extends Record<string, any> = any>(tableName: string): Knex.QueryBuilder<T> {
        return this.knex<T>(tableName)
    }

    /**
     * Execute queries within a transaction
     */
    async transaction<T>(callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
        return await this.knex.transaction(callback)
    }

    /**
     * Destroy the connection pool
     */
    async destroy(): Promise<void> {
        await this.knex.destroy()
    }

    async beforeRun(): Promise<void> { }

    async run(): Promise<void> { }

    commands() {
        return [
            {
                command: 'ping',
                description: 'Test database connection',
                action: async () => {
                    try {
                        await this.knex.raw('SELECT 1')
                        return { success: true, message: 'Connection successful!' }
                    } catch (error) {
                        return { success: false, message: (error as Error).message }
                    }
                },
            },
        ]
    }
}
