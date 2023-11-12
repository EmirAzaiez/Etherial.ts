import { Server } from "socket.io";
import etherial from "../../index"

import { IEtherialModule } from "../../index"

export class AdminJS implements IEtherialModule {

    etherial_module_name: string = 'adminjs'
    adminRoutePath: string
    AdminJS: any
    componentLoader: any

    constructor({ adminRoutePath } : { adminRoutePath: string }) {
        this.adminRoutePath = adminRoutePath

        import("adminjs").then(({ AdminJS, ComponentLoader }) => {
            this.AdminJS = AdminJS
            this.componentLoader = new ComponentLoader()
        });

        return this
    }

    async injectAdminJS(config) {

        let AdminJSExpress = await import("@adminjs/express");
        let AdminJSSequelize = await import("@adminjs/sequelize");

        this.AdminJS.registerAdapter({
            Resource: AdminJSSequelize.Resource,
            Database: AdminJSSequelize.Database,
        })

        const adminRouter = AdminJSExpress.buildRouter(new this.AdminJS(config))

        etherial.http.app.use(this.adminRoutePath, adminRouter)

    }

}