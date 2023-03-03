import { Table } from "sequelize-typescript"
import etherial from '../../index'

export enum ReactiveTableHookType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete'
}

export enum ReactiveTableForwardType {
    ROOMS = 'rooms',
    USERS = 'users',
}

export const ReactiveTable = (options: any) => {

    return function(target: any, propertyKey: string) {

        if (!options.hook) {
            options.hooks = {}
        }

        if (options.reactive) {

            const createHook = (func) => {

                return (instance: any) => {

                    func({
                        instance: instance,
                        forwardToUsers: (ids: number[], newInstance = instance) => {

                            ids.map((id) => {
                                etherial["http_database_reactive"].io.to(`user_${id}`, {
                                    data: JSON.parse(JSON.stringify(instance))
                                })
                            })
                            
                        },
                        forwardToRooms: (rooms: string[], newInstance = instance) => {

                            rooms.forEach((room) => {
                                etherial["http_database_reactive"].io.to(room, {
                                    data: JSON.parse(JSON.stringify(instance))
                                })
                            })

                        }

                    })
    
                }

            }

            if (options.reactive[ReactiveTableHookType.CREATE]) {
                options.hooks.afterCreate = createHook(options.reactive[ReactiveTableHookType.CREATE])
            }

            if (options.reactive[ReactiveTableHookType.UPDATE]) {
                options.hooks.afterUpdate = createHook(options.reactive[ReactiveTableHookType.UPDATE])
            }

            if (options.reactive[ReactiveTableHookType.DELETE]) {
                options.hooks.afterDelete = createHook(options.reactive[ReactiveTableHookType.DELETE])
            }

        }

        delete options.reactive

        return Table(options)(target, propertyKey)
    };

}

// let test = {
//     [ReactiveTableHookType.CREATE]: ({forwardToRooms, instance}) => {
//         forwardToRooms(["users"])
//     }
// }