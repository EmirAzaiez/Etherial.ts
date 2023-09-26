import { TableOptions, Model } from "sequelize-typescript";
interface ReactiveParams {
    onCreate?: (cb: (instance?: Model<any, any>) => ReactiveHookCallbackReturn) => void;
    onUpdate?: (cb: (instance?: Model<any, any>) => ReactiveHookCallbackReturn) => void;
    onDelete?: (cb: (instance?: Model<any, any>) => ReactiveHookCallbackReturn) => void;
    onAll?: (cb: (instance?: Model<any, any>) => ReactiveHookCallbackReturn) => void;
}
interface ReactiveTableOptions extends TableOptions {
    hook?: any;
    reactive: (options: ReactiveParams) => void;
}
interface ReactiveHookCallbackReturn {
    instance?: any;
    users?: number[];
    rooms?: (string | "all" | "guests" | "users")[];
}
export declare const ReactiveTable: (options: ReactiveTableOptions) => (target: Function) => any;
export {};
