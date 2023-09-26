import 'reflect-metadata';
export interface IEtherial {
    init(config: any): void;
    run(): Promise<any>;
    commands(): void;
    initDone: boolean;
    initInProgress: boolean;
}
export declare class Etherial implements IEtherial {
    initDone: boolean;
    initInProgress: boolean;
    init(config: any): void;
    run(): Promise<unknown>;
    commands(): Promise<unknown>;
}
declare const _default: Etherial;
export default _default;
