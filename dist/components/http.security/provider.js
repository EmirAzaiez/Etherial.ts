"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("../../index"));
const provider_1 = require("../http/provider");
exports.ShouldBeAuthentificate = () => {
    return provider_1.Middleware(index_1.default['http_security'].authentificatorMiddleware);
};
exports.ShouldHaveRole = (role) => {
    return provider_1.Middleware(index_1.default['http_security'].authentificatorRoleCheckerMiddleware(role));
};
//# sourceMappingURL=provider.js.map