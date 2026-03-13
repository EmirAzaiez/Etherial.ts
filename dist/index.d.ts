import 'reflect-metadata';
import { Http } from './components/http/index.js';
import { HttpAuth } from './components/http.auth/index.js';
import { HttpSecurity } from './components/http.security/index.js';
import { Reactive } from './components/reactive/index.js';
import { Database } from './components/database/index.js';
import { RawSQL } from './components/sql/index.js';
import { Translation } from './components/translation/index.js';
import { HttpFront } from './components/http.front/index.js';
import { EthLeafS3 } from './leafs/s3/index.js';
import ETHMediaLeaf from './leafs/ETHMediaLeaf/app.js';
import ETHUserLeaf from './leafs/ETHUserLeaf/app.js';
import ETHAdminLeaf from './leafs/ETHAdminLeaf/app.js';
import ETHPulseLeaf from './leafs/ETHPulseLeaf/app.js';
export interface ModuleConfig {
    [key: string]: unknown;
}
export interface IEtherialModule {
    beforeRun?(etherial: IEtherial): Promise<void> | void;
    run?(etherial: IEtherial): Promise<void> | void;
    afterRun?(etherial: IEtherial): Promise<void> | void;
    commands?(etherial: IEtherial): CommandDefinition[];
}
export interface CommandDefinition {
    command: string;
    description?: string;
    action: (...args: unknown[]) => Promise<any> | any;
}
export interface IEtherial {
    init(config: EtherialModuleMap): void;
    run(): Promise<Etherial>;
    commands(): Promise<CommandDefinition[]>;
    initDone: boolean;
    initInProgress: boolean;
    database?: Database;
    http?: Http;
    http_front?: HttpFront;
    http_auth?: HttpAuth;
    http_security?: HttpSecurity;
    reactive?: Reactive;
    translation?: Translation;
    sql?: RawSQL;
    leaf_s3?: EthLeafS3;
    eth_media_leaf?: ETHMediaLeaf;
    eth_user_leaf?: ETHUserLeaf;
    eth_admin_leaf?: ETHAdminLeaf;
    eth_pulse_leaf?: ETHPulseLeaf;
}
type ModuleConstructor = new (config: ModuleConfig) => IEtherialModule;
type ModuleWithConfig = {
    module: ModuleConstructor;
    config: ModuleConfig;
};
type EtherialModuleMap = {
    [key: string]: ModuleWithConfig;
};
export declare class Etherial implements IEtherial {
    database?: Database;
    http?: Http;
    http_front?: HttpFront;
    http_auth?: HttpAuth;
    http_security?: HttpSecurity;
    reactive?: Reactive;
    translation?: Translation;
    sql?: RawSQL;
    leaf_s3?: EthLeafS3;
    eth_media_leaf?: ETHMediaLeaf;
    eth_user_leaf?: ETHUserLeaf;
    eth_admin_leaf?: ETHAdminLeaf;
    eth_pulse_leaf?: ETHPulseLeaf;
    initDone: boolean;
    initInProgress: boolean;
    private static readonly RESERVED_KEYS;
    /**
     * Get sorted module keys, with 'app' always last
     */
    private getModuleKeys;
    /**
     * Initialize Etherial with module configurations
     */
    init(config: EtherialModuleMap): void;
    /**
     * Run lifecycle: beforeRun → run → afterRun (in sequence)
     */
    run(): Promise<Etherial>;
    /**
     * Collect all commands from modules
     */
    commands(): Promise<CommandDefinition[]>;
}
declare const _default: Etherial;
export default _default;
