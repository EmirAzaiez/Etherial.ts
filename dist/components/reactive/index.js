"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reactive = void 0;
const socket_io_1 = require("socket.io");
const index_1 = __importDefault(require("../../index"));
class Reactive {
    constructor() {
        return this;
    }
    listen(listeners = []) {
        return new Promise((resolve) => {
            this.io = new socket_io_1.Server(index_1.default["http"].server, {
                cors: {
                    origin: "*",
                    methods: ["PUT", "GET", "POST", "DELETE", "OPTIONS"],
                    credentials: false
                }
            });
            this.io.on("connection", (socket) => {
                socket.join('all');
                socket.join('guests');
                if (index_1.default["http_security"]) {
                    socket.on('auth', (token) => {
                        let decoded = index_1.default["http_security"].decodeToken(token);
                        if (decoded) {
                            index_1.default["http_security"].customAuthentificationChecker(decoded.user_id).then((user) => {
                                socket.join(`user_${user.id}`);
                                socket.join(`users`);
                                socket.leave(`guests`);
                            });
                        }
                    });
                    socket.on('deauth', () => {
                        Object.keys(socket.rooms).forEach((room) => __awaiter(this, void 0, void 0, function* () {
                            if (room !== socket.id && room !== 'all') {
                                yield socket.leave(room);
                            }
                        }));
                        socket.join('guests');
                    });
                    listeners.forEach((listener) => {
                        socket.on(listener.event, listener.callback);
                    });
                }
            });
            resolve(true);
        });
    }
    userJoinRoom(userId, room) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.io) {
                const userRoom = `user_${userId}`;
                const clients = this.io.sockets.adapter.rooms.get(userRoom);
                for (const clientId of clients) {
                    const clientSocket = this.io.sockets.sockets.get(clientId);
                    yield clientSocket.join(room);
                }
            }
        });
    }
    userLeaveRoom(userId, room) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.io) {
                const userRoom = `user_${userId}`;
                const clients = this.io.sockets.adapter.rooms.get(userRoom);
                for (const clientId of clients) {
                    const clientSocket = this.io.sockets.sockets.get(clientId);
                    yield clientSocket.leave(room);
                }
            }
        });
    }
}
exports.Reactive = Reactive;
//# sourceMappingURL=index.js.map