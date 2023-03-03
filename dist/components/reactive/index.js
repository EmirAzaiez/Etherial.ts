"use strict";
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
    run({ http, http_security }) {
        this.io = new socket_io_1.Server(http.server);
        this.io.on("connection", (socket) => {
            socket.join('all');
            if (http_security) {
                socket.on('auth', (token) => {
                    let decoded = index_1.default["http_security"].decodeToken(token);
                    if (decoded) {
                        index_1.default["http_security"].customAuthentificationChecker(decoded.user_id).then((user) => {
                            socket.join(`user_${user.id}`);
                            socket.join(`users`);
                            if (this.userJoinCustomRoom) {
                                this.userJoinCustomRoom(user).then((room) => {
                                    socket.join(room);
                                });
                            }
                        });
                    }
                });
            }
        });
    }
}
exports.Reactive = Reactive;
//# sourceMappingURL=index.js.map