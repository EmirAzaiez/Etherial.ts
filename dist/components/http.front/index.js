var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import expressLayouts from 'express-ejs-layouts';
export class HttpFront {
    constructor(config = {}) {
        this.config = Object.assign({ viewEngine: 'ejs' }, config);
        this.log = this.setupLogging(config.logging);
    }
    setupLogging(logging) {
        if (logging === false) {
            return () => { };
        }
        if (typeof logging === 'function') {
            return logging;
        }
        return (message) => console.log(`[HttpFront] ${message}`);
    }
    beforeRun() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    run(_a) {
        return __awaiter(this, arguments, void 0, function* ({ http }) {
            if (!http) {
                throw new Error('HttpFront requires the Http module to be registered first.');
            }
            http.app.use(expressLayouts);
            http.app.set('view engine', this.config.viewEngine);
            if (this.config.viewsFolder) {
                http.app.set('views', this.config.viewsFolder);
                this.log(`Views folder set to: ${this.config.viewsFolder}`);
            }
            if (this.config.defaultLayout) {
                http.app.set('layout', this.config.defaultLayout);
                this.log(`Default layout set to: ${this.config.defaultLayout}`);
            }
            this.log(`View engine configured: ${this.config.viewEngine}`);
        });
    }
    afterRun() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    commands() {
        return [];
    }
}
//# sourceMappingURL=index.js.map