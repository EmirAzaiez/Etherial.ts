import { Sequelize } from 'sequelize-typescript';
import { IEtherialModule } from '../../index';
import { Dialect } from 'sequelize';
export declare class Database implements IEtherialModule {
    etherial_module_name: string;
    models: any[];
    sequelize: Sequelize;
    constructor({ server, port, name, username, password, dialect, models }: DatabaseConfig);
    run(): Promise<void>;
    addModels(models: any[]): void;
    sync(): void;
    commands(): {
        command: string;
        description: string;
        warn: boolean;
        action: (etherial: any, env: any) => Promise<{
            success: boolean;
            message: any;
        }>;
    }[];
}
export interface DatabaseConfig {
    server: string;
    port: number;
    name: string;
    username: string;
    password: string;
    dialect: Dialect;
    models: any[];
}
