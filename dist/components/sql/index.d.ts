import { Knex } from 'knex';
import { IEtherialModule } from '../../index';
type RawSQLDialect = 'mysql' | 'mysql2' | 'pg' | 'sqlite3' | 'mssql' | 'oracledb';
export interface RawSQLConfig {
    server: string;
    port: number;
    name: string;
    username: string;
    password: string;
    dialect: RawSQLDialect;
    pool?: {
        min?: number;
        max?: number;
    };
    ssl?: boolean | {
        rejectUnauthorized?: boolean;
    };
}
export declare class RawSQL implements IEtherialModule {
    private config;
    knex: Knex;
    constructor(config: RawSQLConfig);
    private validateConfig;
    /**
     * Execute a raw SQL query
     */
    raw<T = any>(sql: string, bindings?: readonly Knex.RawBinding[]): Promise<T>;
    /**
     * Start a query on a specific table
     */
    table<T extends Record<string, any> = any>(tableName: string): Knex.QueryBuilder<T>;
    /**
     * Execute queries within a transaction
     */
    transaction<T>(callback: (trx: Knex.Transaction) => Promise<T>): Promise<T>;
    /**
     * Destroy the connection pool
     */
    destroy(): Promise<void>;
    beforeRun(): Promise<void>;
    run(): Promise<void>;
    commands(): {
        command: string;
        description: string;
        action: () => Promise<{
            success: boolean;
            message: string;
        }>;
    }[];
}
export {};
