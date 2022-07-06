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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// import * as expressJWT from 'express-jwt'
const jwt = __importStar(require("jsonwebtoken"));
class HttpSecurity {
    constructor({ secret, authorizedRoutes, type, model, roles, column }) {
        this.secret = secret;
        this.authorizedRoutes = authorizedRoutes;
        this.type = type;
        this.model = model;
        this.roles = roles;
        this.column = column;
        if (this.type === 'JWT') {
            this.generateToken = (data) => {
                return jwt.sign(data, this.secret);
            };
            this.authentificatorMiddleware = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
                let token = req.headers["authorization"];
                if (token.startsWith("Bearer ")) {
                    let decoded = jwt.decode(token.substring(7, token.length), this.secret);
                    if (decoded) {
                        let user = yield model.findOne({ where: { 'id': decoded.user_id } });
                        if (user != null) {
                            req.user = user;
                            return next(false);
                        }
                    }
                    else {
                        res.error({ status: 401, errors: ['forbidden'] });
                    }
                }
                else {
                    res.error({ status: 401, errors: ['forbidden'] });
                }
            });
            this.authentificatorRoleCheckerMiddleware = (role = "CLIENT") => {
                return (req, res, next) => {
                    if (req.user) {
                        let checkrole = this.roles[role];
                        if (checkrole(req.user[column])) {
                            next(null);
                        }
                        else {
                            res.error({ status: 401, errors: ['forbidden'] });
                        }
                    }
                    else {
                        res.error({ status: 401, errors: ['forbidden'] });
                    }
                };
            };
        }
    }
}
exports.default = HttpSecurity;
//# sourceMappingURL=index.js.map