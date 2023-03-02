var expressLayouts = require('express-ejs-layouts');

export default class HttpFront {

    viewsFolder: string;
    defaultLayout: string;
    viewEngine: string;

    constructor({viewsFolder = "", defaultLayout = ""}) {
        this.viewsFolder = viewsFolder
        this.defaultLayout = defaultLayout
    }

    run({http}) {
        http.app.use(expressLayouts);
        
        http.app.set('view engine', "ejs");

        if (this.viewsFolder) {
            http.app.set('views', this.viewsFolder);
        }

        if (this.defaultLayout) {
            http.app.set('layout', this.defaultLayout);
        }
    }

}