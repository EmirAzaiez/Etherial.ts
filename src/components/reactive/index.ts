import { Server } from "socket.io";
import etherial from "../../index"

interface ReactiveListener {
    event: string,
    callback: (data: any) => void
}

import { IEtherialModule } from "../../index"

export class Reactive implements IEtherialModule {

    etherial_module_name: string = 'reactive'

    io: Server;

    constructor() {
        return this
    }

    listen(listeners: ReactiveListener[] = []) {

        return new Promise((resolve) => {

            this.io = new Server(etherial["http"].server, {
                cors: {
                    origin: "*",
                    methods: ["PUT", "GET", "POST", "DELETE", "OPTIONS"],
                    credentials: false
                }
            });

            this.io.on("connection", (socket) => {

                socket.join('all')
                socket.join('guests')

                if (etherial["http_security"]) {

                    socket.on('auth', (token) => {

                        let decoded = etherial["http_security"].decodeToken(token)

                        if (decoded) {

                            etherial["http_security"].customAuthentificationJWTChecker(decoded).then((user) => {
                                socket.join(`user_${user.id}`)
                                socket.join(`users`)
                                socket.leave(`guests`)
                            })
            
                        }
                
                    })

                    socket.on('deauth', () => {
                        
                        Array.from(socket.rooms).forEach(async (room) => {
                            if (room !== socket.id && room !== 'all') {
                                await socket.leave(room);
                            }
                        });

                        socket.join('guests')

                    })

                    listeners.forEach((listener) => {
                        socket.on(listener.event, listener.callback)
                    })

                }

            })

            resolve(true)
        })

    }

    async userJoinRoom(userId: string, room: string) {

        if (this.io) {

            const userRoom = `user_${userId}`;
            const clients = this.io.sockets.adapter.rooms.get(userRoom);
            
            for (const clientId of clients) {
                const clientSocket = this.io.sockets.sockets.get(clientId);
                await clientSocket.join(room)
           }

        }

    }

    async userLeaveRoom(userId: string, room: string) {

        if (this.io) {

            const userRoom = `user_${userId}`;
            const clients = this.io.sockets.adapter.rooms.get(userRoom);
            
            for (const clientId of clients) {
                const clientSocket = this.io.sockets.sockets.get(clientId);
                await clientSocket.leave(room)
           }

        }

    }

}