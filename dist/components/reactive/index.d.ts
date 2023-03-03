import { Server } from "socket.io";
export declare class Reactive {
    io: Server;
    userJoinCustomRoom: (user: any) => Promise<string>;
    constructor();
    run({ http, http_security }: {
        http: any;
        http_security: any;
    }): void;
}
