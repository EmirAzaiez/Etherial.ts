import { Sequelize, ModelCtor, Model } from 'sequelize-typescript';
import { IEtherialModule } from '../../index';
import { Dialect } from 'sequelize';
export type LoggingFunction = (sql: string, timing?: number) => void;
export interface DatabaseConfig {
    server: string;
    port: number;
    name: string;
    username: string;
    password: string;
    dialect: Dialect;
    models?: ModelCtor<Model>[];
    logging?: boolean | LoggingFunction;
    storage?: string;
    ssl?: boolean | {
        rejectUnauthorized?: boolean;
    };
    define?: {
        underscored?: boolean;
        timestamps?: boolean;
        paranoid?: boolean;
        freezeTableName?: boolean;
    };
    timezone?: string;
}
export declare class Database implements IEtherialModule {
    models: ModelCtor<Model>[];
    sequelize: Sequelize;
    private config;
    constructor(config: DatabaseConfig);
    private validateConfig;
    beforeRun(): Promise<void>;
    run(): Promise<void>;
    addModels(models: ModelCtor<Model>[]): void;
    sync(options?: {
        force?: boolean;
        alter?: boolean;
    }): Promise<void>;
    transaction<T>(callback: (t: any) => Promise<T>): Promise<T>;
    commands(): {
        command: string;
        description: string;
        warn: boolean;
        action: (_etherial: any, env: string) => Promise<{
            success: boolean;
            message: string;
        }>;
    }[];
}
