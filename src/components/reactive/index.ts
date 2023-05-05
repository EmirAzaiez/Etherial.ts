import { Server } from "socket.io";
import etherial from "../../index"

export class Reactive {

    io: Server;
    userJoinCustomRoom: (user) => Promise<string>

    constructor() {
        return this
    }

    listen() {

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
                socket.join('visitors')

                if (etherial["http_security"]) {

                    socket.on('auth', (token) => {

                        let decoded = etherial["http_security"].decodeToken(token)

                        if (decoded) {

                            etherial["http_security"].customAuthentificationChecker(decoded.user_id).then((user) => {
                                socket.join(`user_${user.id}`)
                                socket.join(`users`)
                                socket.leave(`visitors`)
                                if (this.userJoinCustomRoom) {
                                    this.userJoinCustomRoom(user).then((room) => {
                                        socket.join(room)
                                    })
                                }
                            })
            
                        }
                
                    })

                }

            })

            resolve(true)
        })

    }

}