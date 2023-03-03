export declare enum ReactiveTableHookType {
    CREATE = "create",
    UPDATE = "update",
    DELETE = "delete"
}
export declare enum ReactiveTableForwardType {
    ROOMS = "rooms",
    USERS = "users"
}
export declare const ReactiveTable: (options: any) => (target: any, propertyKey: string) => any;
