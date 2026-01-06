import 'reflect-metadata';
import { Http } from './components/http';
import { HttpAuth } from './components/http.auth';
import { HttpSecurity } from './components/http.security';
import { Reactive } from './components/reactive';
import { Database } from './components/database';
import { RawSQL } from './components/sql';
import { Translation } from './components/translation';
import { HttpFront } from './components/http.front';
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
