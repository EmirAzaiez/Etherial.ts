import 'reflect-metadata';
import { Http } from './components/http';
import { HttpSecurity } from './components/http.security';
import { Reactive } from './components/reactive';
import { Database } from './components/database';
import { SQL } from './components/sql';
import Translation from './components/translation';
import HttpFront from './components/http.front';
import { EthLeafS3 } from './leafs/s3';
export interface IEtherial {
    init(config: any): void;
    run(): Promise<any>;
    commands(): Promise<any[]>;
    initDone: boolean;
    initInProgress: boolean;
    database?: Database;
    http?: Http;
    http_front?: HttpFront;
    http_security?: HttpSecurity;
    reactive?: Reactive;
    translation?: Translation;
    leaf_s3?: EthLeafS3;
}
export interface IEtherialModule {
    etherial_module_name: string;
}
type ModuleWithConfig<T extends IEtherialModule> = {
    module: T;
    config: any;
};
type EtherialModuleMap<T extends IEtherialModule> = {
    [key: string]: ModuleWithConfig<T>;
};
export declare class Etherial implements IEtherial {
    database?: Database;
    http?: Http;
    http_front?: HttpFront;
    http_security?: HttpSecurity;
    reactive?: Reactive;
    translation?: Translation;
    sql?: SQL;
    leaf_s3?: EthLeafS3;
    initDone: boolean;
    initInProgress: boolean;
    init(config: EtherialModuleMap<IEtherialModule>): void;
    run(): Promise<unknown>;
    commands(): Promise<any[]>;
}
declare const _default: Etherial;
export default _default;
