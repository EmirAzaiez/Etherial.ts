"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var expressLayouts = require('express-ejs-layouts');
class HttpFront {
    constructor({ viewsFolder = "", defaultLayout = "" }) {
        this.etherial_module_name = 'http_front';
        this.viewsFolder = viewsFolder;
        this.defaultLayout = defaultLayout;
    }
    run({ http }) {
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
exports.default = HttpFront;
//# sourceMappingURL=index.js.map