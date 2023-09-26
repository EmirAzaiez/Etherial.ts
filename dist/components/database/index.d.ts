import { Sequelize } from "sequelize-typescript";
export declare class Database {
    sequelize: Sequelize;
    constructor({ server, port, name, username, password, dialect, models }: {
        server: any;
        port: any;
        name: any;
        username: any;
        password: any;
        dialect: any;
        models: any;
    });
    run(): Promise<void>;
    addModels(models: any): this;
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
