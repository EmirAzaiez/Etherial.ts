import { Server } from "socket.io";
export declare class Reactive {
    io: Server;
    userJoinCustomRoom: (user: any) => Promise<string>;
    constructor();
    listen(): Promise<unknown>;
}
