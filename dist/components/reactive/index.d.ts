import { Server } from "socket.io";
interface ReactiveListener {
    event: string;
    callback: (data: any) => void;
}
export declare class Reactive {
    io: Server;
    constructor();
    listen(listeners?: ReactiveListener[]): Promise<unknown>;
    userJoinRoom(userId: string, room: string): Promise<void>;
    userLeaveRoom(userId: string, room: string): Promise<void>;
}
export {};
