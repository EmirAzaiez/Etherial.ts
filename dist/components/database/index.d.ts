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
        'database:destroy': {
            arguments: {};
            callback: (args: any) => void;
        };
        'database:load:fixtures': {
            arguments: {
                '--path': StringConstructor[];
            };
            callback: (args: any) => void;
        };
    };
}
