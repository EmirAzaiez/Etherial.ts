import { Server, Socket } from 'socket.io';
import { IEtherialModule } from '../../index';
interface ReactiveListener {
    event: string;
    callback: (data: any, socket: Socket) => void | Promise<void>;
}
interface SocketMiddleware {
    (socket: Socket, next: (err?: Error) => void): void;
}
export interface ReactiveConfig {
    cors?: {
        origin: string | string[];
        methods?: string[];
        credentials?: boolean;
    };
    pingInterval?: number;
    pingTimeout?: number;
    maxHttpBufferSize?: number;
}
interface ConnectedUser {
    socketId: string;
    userId?: string | number;
    rooms: Set<string>;
    connectedAt: Date;
    lastActivity: Date;
}
export declare class Reactive implements IEtherialModule {
    io: Server | null;
    private config;
    private connectedSockets;
    private middlewares;
    private globalListeners;
    constructor(config?: ReactiveConfig);
    /**
     * Add middleware to be executed on each socket connection
     */
    useMiddleware(middleware: SocketMiddleware): this;
    /**
     * Add global listener for all sockets
     */
    on(event: string, callback: (data: any, socket: Socket) => void | Promise<void>): this;
    /**
     * Start listening for socket connections
     */
    listen(listeners?: ReactiveListener[]): Promise<boolean>;
    /**
     * Handle new socket connection
     */
    private handleConnection;
    /**
     * Setup authentication handlers
     */
    private setupAuthHandlers;
    /**
     * Deauthenticate a socket
     */
    private deauthenticateSocket;
    /**
     * Setup custom event listeners
     */
    private setupListeners;
    /**
     * Setup disconnect handler
     */
    private setupDisconnectHandler;
    /**
     * Track socket activity for potential idle detection
     */
    private setupActivityTracking;
    /**
     * Emit to specific rooms
     */
    emit(rooms: string | string[], event: string, data: any): void;
    /**
     * Emit to all connected sockets
     */
    emitToAll(event: string, data: any): void;
    /**
     * Emit to all authenticated users
     */
    emitToUsers(event: string, data: any): void;
    /**
     * Emit to all guests (non-authenticated)
     */
    emitToGuests(event: string, data: any): void;
    /**
     * Emit to a specific user by ID
     */
    emitToUser(userId: string | number, event: string, data: any): void;
    /**
     * Emit to multiple users by IDs
     */
    emitToUsers_ids(userIds: (string | number)[], event: string, data: any): void;
    /**
     * Get all sockets for a specific user
     */
    getUserSockets(userId: string | number): Promise<Socket[]>;
    /**
     * Make a user join a room
     */
    userJoinRoom(userId: string | number, room: string): Promise<number>;
    /**
     * Make a user leave a room
     */
    userLeaveRoom(userId: string | number, room: string): Promise<number>;
    /**
     * Check if a user is online
     */
    isUserOnline(userId: string | number): boolean;
    /**
     * Get count of online users in a room
     */
    getRoomSize(room: string): number;
    /**
     * Get all connected socket info
     */
    getConnectedSockets(): Map<string, ConnectedUser>;
    /**
     * Get count of all connected sockets
     */
    getConnectionCount(): number;
    /**
     * Get count of authenticated users (unique)
     */
    getAuthenticatedUserCount(): number;
    /**
     * Disconnect a specific user from all their sockets
     */
    disconnectUser(userId: string | number, reason?: string): Promise<number>;
    /**
     * Broadcast to a room except sender
     */
    broadcastToRoom(socket: Socket, room: string, event: string, data: any): void;
    beforeRun(): Promise<void>;
    run(): Promise<void>;
    afterRun(): Promise<void>;
}
export {};
