import { IEtherialModule } from '../../index';
import { Knex } from 'knex';
export declare class SQL implements IEtherialModule {
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
    commands(): any[];
}
export interface SQLConfig {
    server: string;
    port: number;
    name: string;
    username: string;
    password: string;
    dialect: string;
}
