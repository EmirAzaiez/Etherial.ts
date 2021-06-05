"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var expressLayouts = require('express-ejs-layouts');
class HttpFront {
    constructor({ viewsFolder, defaultLayout }) {
        this.viewsFolder = viewsFolder;
        this.defaultLayout = defaultLayout;
    }
    run({ http }) {
        http.app.use(expressLayouts);
        http.app.set('view engine', 'ejs');
        http.app.set('views', this.viewsFolder);
        http.app.set('layout', this.defaultLayout);
    }
}
exports.default = HttpFront;
//# sourceMappingURL=index.js.map