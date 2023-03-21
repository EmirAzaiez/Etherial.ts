"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// import * as expressJWT from 'express-jwt'
const jwt = __importStar(require("jsonwebtoken"));
class HttpSecurity {
    constructor({ secret, type, roles, role_column }) {
        this.secret = secret;
        this.type = type;
        this.roles = roles;
        this.role_column = role_column;
        this.authentificatorRoleCheckerMiddleware = (role = "CLIENT") => {
            return (req, res, next) => {
                if (req.user) {
                    let checkrole = this.roles[role];
                    if (checkrole.includes(req.user[role_column])) {
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
        // if (this.type === 'JWT') {
        this.generateToken = (data) => {
            return jwt.sign(data, this.secret);
        };
        this.decodeToken = (token) => {
            return jwt.decode(token.substring(7, token.length), this.secret);
        };
        this.authentificatorMiddleware = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            if (req.user) {
                return next();
            }
            let token = req.headers["authorization"];
            if (token && token.startsWith("Bearer ")) {
                let decoded = this.decodeToken(token.substring(7, token.length));
                if (decoded) {
                    this.customAuthentificationChecker(decoded.user_id).then((user) => {
                        req.user = user;
                        next();
                    }).catch(() => {
                        res.error({ status: 401, errors: ['forbidden'] });
                    });
                }
                else {
                    res.error({ status: 401, errors: ['forbidden'] });
                }
            }
            else {
                res.error({ status: 401, errors: ['forbidden'] });
            }
        });
        // } else if (this.type === 'SESSION') {
        // } else if (this.type === 'BASIC') {
        // }
    }
    setCustomAuthentificationChecker(customFunction) {
        this.customAuthentificationChecker = customFunction;
    }
    setCustomAuthentificationRoleChecker(customFunction) {
        this.customAuthentificationRoleChecker = customFunction;
    }
}
exports.default = HttpSecurity;
//# sourceMappingURL=index.js.map