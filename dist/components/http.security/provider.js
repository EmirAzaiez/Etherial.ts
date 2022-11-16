"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShouldBeAuthentificateWithRole = exports.ShouldBeAuthentificate = void 0;
const index_1 = __importDefault(require("../../index"));
const provider_1 = require("../http/provider");
const ShouldBeAuthentificate = () => {
    return (0, provider_1.Middleware)(index_1.default['http_security'].authentificatorMiddleware);
};
exports.ShouldBeAuthentificate = ShouldBeAuthentificate;
const ShouldBeAuthentificateWithRole = (role) => {
    return (0, provider_1.Middleware)([
        index_1.default['http_security'].authentificatorMiddleware,
        index_1.default['http_security'].authentificatorRoleCheckerMiddleware(role)
    ]);
};
exports.ShouldBeAuthentificateWithRole = ShouldBeAuthentificateWithRole;
//# sourceMappingURL=provider.js.map