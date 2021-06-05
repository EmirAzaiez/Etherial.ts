var expressLayouts = require('express-ejs-layouts');

import { Http } from '../http'

export default class HttpFront {

    viewsFolder: String;
    defaultLayout: String;

    constructor({viewsFolder, defaultLayout}) {
        this.viewsFolder = viewsFolder
        this.defaultLayout = defaultLayout
    }

    run({http}) {
        http.app.use(expressLayouts);
        http.app.set('view engine', 'ejs');
        http.app.set('views', this.viewsFolder);
        http.app.set('layout', this.defaultLayout);
    }

}