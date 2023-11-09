import { Sequelize } from "sequelize-typescript";
import { IEtherialModule } from "../../index";
export declare class Database implements IEtherialModule {
    etherial_module_name: string;
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
