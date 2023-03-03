import { Server } from "socket.io";
import etherial from "../../index"

export class Reactive {

    io: Server;
    userJoinCustomRoom: (user) => Promise<string>

    constructor() {
        return this
    }

    run({ http, http_security }) {

        this.io = new Server(http.server);

        this.io.on("connection", (socket) => {

            if (http_security) {

                socket.on('auth', (token) => {

                    let decoded = etherial["http_security"].decodeToken(token)

                    if (decoded) {

                        etherial["http_security"].customAuthentificationChecker(decoded.user_id).then((user) => {
                            socket.join(`user_${user.id}`)
                            socket.join(`users`)
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

    }

}