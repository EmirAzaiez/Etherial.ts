import { IEtherialModule } from '../../index'

var expressLayouts = require('express-ejs-layouts')

export class HttpFront implements IEtherialModule {
    etherial_module_name: string = 'http_front'

    viewsFolder: string
    defaultLayout: string
    viewEngine: string

    constructor({ viewsFolder = '', defaultLayout = '' }) {
        this.viewsFolder = viewsFolder
        this.defaultLayout = defaultLayout
    }

    run({ http }) {
        http.app.use(expressLayouts)

        http.app.set('view engine', 'ejs')

        if (this.viewsFolder) {
            http.app.set('views', this.viewsFolder)
        }

        if (this.defaultLayout) {
            http.app.set('layout', this.defaultLayout)
        }
    }
}

export interface HttpFrontConfig {
    viewsFolder: string
    defaultLayout: string
}
