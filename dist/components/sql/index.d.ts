import { IEtherialModule } from '../../index';
import { Knex } from 'knex';
export declare class Database implements IEtherialModule {
    etherial_module_name: string;
    knex: Knex;
    constructor({ server, port, name, username, password, dialect }: {
        server: any;
        port: any;
        name: any;
        username: any;
        password: any;
        dialect: any;
    });
    run(): Promise<void>;
    commands(): any[];
}
