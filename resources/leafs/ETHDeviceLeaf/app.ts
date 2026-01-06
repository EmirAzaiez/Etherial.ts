import { Etherial } from 'etherial'
import * as path from 'path'

export default class EthDeviceLeaf {
    etherial_module_name = 'eth_device_leaf'
    last_app_build: string
    private routes: { route: string; methods: string[] }[] = []

    constructor(config: ETHDeviceLeafConfig) {
        if (config.routes) {
            if (config.routes.devices && config.routes.devices.length > 0) {
                this.routes.push({ route: path.join(__dirname, 'routes/devices'), methods: config.routes.devices })
                this.last_app_build = config.last_app_build
            }
        }
    }

    beforeRun({ database }: Etherial) {
        database.addModels([path.join(__dirname, 'models/Device.js'), path.join(__dirname, 'models/DeviceNotificationLog.js')])
    }

    run({ http }: Etherial) {
        http.routes_leafs.push(...this.routes)
    }

    commands() {
        return []
    }
}

export const AvailableRouteMethods = {
    devices: ['registerDevice', 'revokeDevice'],
} as const

export type DevicesMethods = (typeof AvailableRouteMethods.devices)[number]

export interface ETHDeviceLeafConfig {
    last_app_build: string
    routes: {
        devices: DevicesMethods[]
    }
}
