"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminJS = void 0;
const index_1 = __importDefault(require("../../index"));
class AdminJS {
    constructor({ adminRoutePath }) {
        this.etherial_module_name = 'adminjs';
        this.adminRoutePath = adminRoutePath;
        import("adminjs").then(({ AdminJS, ComponentLoader }) => {
            this.AdminJS = AdminJS;
            this.componentLoader = new ComponentLoader();
        });
        return this;
    }
    injectAdminJS(config) {
        return __awaiter(this, void 0, void 0, function* () {
            let AdminJSExpress = yield import("@adminjs/express");
            let AdminJSSequelize = yield import("@adminjs/sequelize");
            this.AdminJS.registerAdapter({
                Resource: AdminJSSequelize.Resource,
                Database: AdminJSSequelize.Database,
            });
            const adminRouter = AdminJSExpress.buildRouter(new this.AdminJS(config));
            index_1.default.http.app.use(this.adminRoutePath, adminRouter);
        });
    }
}
exports.AdminJS = AdminJS;
//# sourceMappingURL=index.js.map