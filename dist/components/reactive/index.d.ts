import { Server } from 'socket.io';
interface ReactiveListener {
    event: string;
    callback: (data: any) => void;
}
import { IEtherialModule } from '../../index';
export declare class Reactive implements IEtherialModule {
    etherial_module_name: string;
    io: Server;
    constructor();
    listen(listeners?: ReactiveListener[]): Promise<unknown>;
    userJoinRoom(userId: string, room: string): Promise<void>;
    userLeaveRoom(userId: string, room: string): Promise<void>;
}
export interface ReactiveConfig {
}
export {};
