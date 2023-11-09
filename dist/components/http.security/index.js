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
exports.HttpSecurity = void 0;
// import * as expressJWT from 'express-jwt'
const jwt = __importStar(require("jsonwebtoken"));
class HttpSecurity {
    constructor({ secret, type }) {
        this.etherial_module_name = 'http_security';
        if (!secret) {
            throw new Error('etherial:http.security ERROR - No secret defined in your app/Config.js .');
        }
        if (!type) {
            throw new Error('etherial:http.security ERROR - No type defined in your app/Config.js .');
        }
        if (type !== "JWT" && type !== "BasicAuth" && type !== "Session") {
            throw new Error('etherial:http.security ERROR - Type should be JWT, BasicAuth or Session.');
        }
        this.secret = secret;
        this.type = type;
        this.authentificatorRoleCheckerMiddleware = (role) => {
            return (req, res, next) => {
                if (req.user) {
                    this.customAuthentificationRoleChecker(req.user, role).then((result) => {
                        next(null);
                    }).catch(() => {
                        res.error({ status: 401, errors: ['forbidden'] });
                    });
                }
                else {
                    res.error({ status: 401, errors: ['forbidden'] });
                }
            };
        };
        //BEGIN Basic Authentification
        this.authentificatorMiddlewareBA = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            if (req.user) {
                return next();
            }
            let token = req.headers["authorization"];
            if (token && token.startsWith("Basic ")) {
                let decoded = Buffer.from(token.substring(6, token.length), 'base64').toString('ascii').split(':');
                if (decoded) {
                    if (this.customAuthentificationBAChecker) {
                        this.customAuthentificationBAChecker({ username: decoded[0], password: decoded[1] }).then((user) => {
                            if (user) {
                                req.user = user;
                                next();
                            }
                            else {
                                res.error({ status: 401, errors: ['forbidden'] });
                            }
                        }).catch(() => {
                            res.error({ status: 401, errors: ['forbidden'] });
                        });
                    }
                    else {
                        throw new Error('No customAuthentificationChecker for JWT defined in your app.ts .');
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
        //END Basic Authentification
        //JWT PART BEGIN
        /**
         * @deprecated This function is deprecated and should be replaced with generateJWTToken.
         */
        this.generateToken = (data) => {
            return jwt.sign(data, this.secret);
        };
        /**
         * @deprecated This function is deprecated and should be replaced with decodeJWTToken.
         */
        this.decodeToken = (token) => {
            return jwt.decode(token, this.secret);
        };
        this.generateJWTToken = (data) => {
            return jwt.sign(data, this.secret);
        };
        this.decodeJWTToken = (token) => {
            return jwt.decode(token, this.secret);
        };
        this.authentificatorMiddlewareJWT = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            if (req.user) {
                return next();
            }
            let token = req.headers["authorization"];
            if (token && token.startsWith("Bearer ")) {
                let decoded = this.decodeJWTToken(token.substring(7, token.length));
                if (decoded) {
                    this.customAuthentificationJWTChecker(decoded).then((user) => {
                        if (user) {
                            req.user = user;
                            next();
                        }
                        else {
                            res.error({ status: 401, errors: ['forbidden'] });
                        }
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
    }
    //JWT PART END
    setCustomAuthentificationChecker(cb, type = this.type) {
        if (type === "JWT") {
            this.customAuthentificationChecker = cb;
            this.customAuthentificationJWTChecker = cb;
        }
        else if (type === "BasicAuth") {
            this.customAuthentificationBAChecker = cb;
        }
        else if (type === "Session") {
            // return Middleware(etherial['http_security'].authentificatorMiddlewareSESSION)
        }
    }
    setCustomAuthentificationRoleChecker(cb) {
        this.customAuthentificationRoleChecker = cb;
    }
    commands() {
        return [
            {
                command: 'generate:token:jwt <user_id>',
                description: 'Generate a JWT token based on a user_id.',
                action: (etherial, user_id) => __awaiter(this, void 0, void 0, function* () {
                    return { success: true, message: this.generateJWTToken({ user_id }) };
                })
            }
        ];
    }
}
exports.HttpSecurity = HttpSecurity;
//# sourceMappingURL=index.js.map