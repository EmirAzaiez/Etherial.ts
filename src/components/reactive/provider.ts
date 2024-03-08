import { Table, TableOptions, Model } from "sequelize-typescript"
import etherial from '../../index'

interface ReactiveParams {
    onCreate?: ( cb:(instance?:  Model<any, any>) => ReactiveHookCallbackReturn ) => void,
    onUpdate?: ( cb:(instance?:  Model<any, any>) => ReactiveHookCallbackReturn ) => void,
    onDelete?: ( cb:(instance?:  Model<any, any>) => ReactiveHookCallbackReturn ) => void,
    onAll?: ( cb:(instance?:  Model<any, any>) => ReactiveHookCallbackReturn ) => void,
}

interface ReactiveTableOptions extends TableOptions {
    hook?: any,
    reactive: (options: ReactiveParams) => void
}

interface ReactiveHookCallbackReturn {
    instance?: any 
    users?: number[] 
    rooms?: (string | "all" | "guests" | "users")[];
}

export const ReactiveTable = (options: ReactiveTableOptions) => {

    const generateHook = (cb, type: string) => {

        return async (instance: Model<any, any>) => {

            let rtnOptions = await cb(instance)
            let rooms = []
    
            if (rtnOptions.instance) {
                instance = rtnOptions.instance;
            }
    
            if (rtnOptions.users) {
                rooms = [...rooms, rtnOptions.users.map((id) => `user_${id}`)]
            }
    
            if (rtnOptions.rooms) {
                rooms = [...rooms, ...rtnOptions.rooms]
            }
    
            rooms.forEach((room) => {

                if (etherial["reactive"] && etherial["reactive"].io) {

                    etherial["reactive"].io.to(room).emit("reactive", {
                        action: type,
                        model: instance.constructor.name,
                        data: JSON.parse(JSON.stringify(instance))
                    })

                }
                
            })
        }

    }
    

    return function(target: Function) {

        if (!options.hook) {
            options.hooks = {}
        }

        if (options.reactive) {

            options.reactive({
                onCreate: (cb) => options.hooks.afterCreate = generateHook(cb, "create"),
                onUpdate: (cb) => options.hooks.afterUpdate = generateHook(cb, "update"),
                onDelete: (cb) => options.hooks.afterDestroy = generateHook(cb, "delete"),
                onAll: (cb) => {
                    options.hooks.afterCreate = generateHook(cb, "create")
                    options.hooks.afterUpdate = generateHook(cb, "update")
                    options.hooks.afterDestroy = generateHook(cb, "delete")
                }
            })

            delete options.reactive

        }

        return Table(options)(target)
    }

}