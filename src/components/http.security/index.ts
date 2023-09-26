import { Http } from '../http';

// import * as expressJWT from 'express-jwt'
import * as jwt from 'jsonwebtoken'

import { Middleware } from '../http/provider'

export class HttpSecurity {

    protected type?: "JWT" | "BasicAuth" | "Session";
    private secret?: String;

    public generateJWTToken?: (data: any) => String
    public decodeJWTToken?: (token: string) => any

    public generateToken?: (data: any) => String
    public decodeToken?: (token: string) => any

    authentificatorMiddlewareJWT: any
    authentificatorMiddlewareBA: any
    
    authentificatorRoleCheckerMiddleware: any
    
    customAuthentificationJWTChecker: (any) => Promise<any>;
    customAuthentificationBAChecker: (any) => Promise<any>;

    customAuthentificationChecker: (cb: (any) => Promise<any>, type?: "JWT" | "BasicAuth" | "Session") => Promise<void>;
   
    customAuthentificationRoleChecker: (user: any, askedRole: any) => Promise<void>;

    constructor({ secret, type }) {

        if (!secret) {
            throw new Error('etherial:http.security ERROR - No secret defined in your app/Config.js .')
        }

        if (!type) {
            throw new Error('etherial:http.security ERROR - No type defined in your app/Config.js .')
        }

        if (type !== "JWT" && type !== "BasicAuth" && type !== "Session") {
            throw new Error('etherial:http.security ERROR - Type should be JWT, BasicAuth or Session.')
        }

        this.secret = secret
        this.type = type

        this.authentificatorRoleCheckerMiddleware = (role: any) => {

            return (req, res, next) => {

                if (req.user) {

                    this.customAuthentificationRoleChecker(req.user, role).then((result) => {
                        next(null)
                    }).catch(() => {
                        res.error({status: 401, errors: ['forbidden']})
                    })

                } else {
                    res.error({status: 401, errors: ['forbidden']})
                }

            }

        }

        //BEGIN Basic Authentification

        this.authentificatorMiddlewareBA = async (req, res, next) => {

            if (req.user) {
                return next()
            }

            let token = req.headers["authorization"];
    
            if (token && token.startsWith("Basic ")) {
                let decoded = Buffer.from(token.substring(6, token.length), 'base64').toString('ascii').split(':')
    
                if (decoded) {

                    if (this.customAuthentificationBAChecker) {
                        
                        this.customAuthentificationBAChecker({username: decoded[0], password: decoded[1]}).then((user) => {
                            if (user) {
                                req.user = user
                                next()
                            } else {
                                res.error({status: 401, errors: ['forbidden']})
                            }
                        }).catch(() => {
                            res.error({status: 401, errors: ['forbidden']})
                        })

                    } else {
                        throw new Error('No customAuthentificationChecker for JWT defined in your app.ts .')
                    }
                    
    
                } else {
                    res.error({status: 401, errors: ['forbidden']})
                }
    
            } else {
                res.error({status: 401, errors: ['forbidden']})
            }

        }

        //END Basic Authentification

        //JWT PART BEGIN

        /**
         * @deprecated This function is deprecated and should be replaced with generateJWTToken.
         */

        this.generateToken = (data: {}) => {
            return jwt.sign(data, this.secret) as String
        }

        /**
         * @deprecated This function is deprecated and should be replaced with decodeJWTToken.
         */

        this.decodeToken = (token) => {
            return jwt.decode(token, this.secret)
        }

        this.generateJWTToken = (data: {}) => {
            return jwt.sign(data, this.secret) as String
        }

        this.decodeJWTToken = (token) => {
            return jwt.decode(token, this.secret)
        }

        this.authentificatorMiddlewareJWT = async (req, res, next) => {

            if (req.user) {
                return next()
            }

            let token = req.headers["authorization"];
    
            if (token && token.startsWith("Bearer ")) {
                let decoded = this.decodeJWTToken(token.substring(7, token.length))
    
                if (decoded) {

                    this.customAuthentificationJWTChecker(decoded).then((user) => {
                        
                        if (user) {
                            req.user = user
                            next()
                        } else {
                            res.error({status: 401, errors: ['forbidden']})
                        }
                        
                    }).catch(() => {
                        res.error({status: 401, errors: ['forbidden']})
                    })
    
                } else {
                    res.error({status: 401, errors: ['forbidden']})
                }
    
            } else {
                res.error({status: 401, errors: ['forbidden']})
            }
        
        }

    }

    //JWT PART END

    setCustomAuthentificationChecker(cb: (args) => Promise<any>, type: "JWT" | "BasicAuth" | "Session" = this.type) {

        if (type === "JWT") {
            this.customAuthentificationChecker = cb
            this.customAuthentificationJWTChecker = cb
        } else if (type === "BasicAuth") {
            this.customAuthentificationBAChecker = cb
        } else if (type === "Session") {
            // return Middleware(etherial['http_security'].authentificatorMiddlewareSESSION)
        }

    }

    setCustomAuthentificationRoleChecker(cb: (user: any, askedRole: any) => Promise<any>) {
        this.customAuthentificationRoleChecker = cb
    }

    commands() {
        return [
            {
                command: 'generate:token:jwt <user_id>',
                description: 'Generate a JWT token based on a user_id.',
                action: async (etherial, user_id) => {
                    return {success: true, message: this.generateJWTToken({user_id})}
                }
            }
        ]
    }

}
