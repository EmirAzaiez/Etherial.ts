import { Http } from '../http';

// import * as expressJWT from 'express-jwt'
import * as jwt from 'jsonwebtoken'

import { Middleware } from '../http/provider'

export default class HttpSecurity {

    type?: String;
    secret?: String;
    authorizedRoutes?: [{url: RegExp | String, method: String}];
    generateToken?: (data: any) => String
    authentificatorMiddleware: any
    authentificatorRoleCheckerMiddleware: any
    model: any;
    roles: any;
    column: string;
    customAuthentificationChecker: (any) => Promise<void>;
    customAuthentificationRoleChecker: (any) => void;

    constructor({ secret, authorizedRoutes, type, model, roles, column }) {
        this.secret = secret
        this.authorizedRoutes = authorizedRoutes
        this.type = type
        this.model = model
        this.roles = roles
        this.column = column

        if (this.type === 'JWT') {

            this.generateToken = (data: {}) => {
                return jwt.sign(data, this.secret) as String
            }

            this.authentificatorMiddleware = async (req, res, next) => {

                let token = req.headers["authorization"];
        
                if (token.startsWith("Bearer ")) {
                    let decoded = jwt.decode(token.substring(7, token.length), this.secret);
        
                    if (decoded) {

                        this.customAuthentificationChecker(decoded.user_id).then((user) => {
                            next()
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
            
            this.authentificatorRoleCheckerMiddleware = (role: string = "CLIENT") => {

                return (req, res, next) => {

                    if (req.user) {

                        let checkrole = this.roles[role]

                        if (checkrole(req.user[column])) {
                            next(null)
                        } else {
                            res.error({status: 401, errors: ['forbidden']})
                        }

                    } else {

                        res.error({status: 401, errors: ['forbidden']})
                        
                    }

                }

            }

        }

    }

    setCustomAuthentificationChecker(customFunction: () => void) {
        this.customAuthentificationChecker = customFunction
    }

    setCustomAuthentificationRoleChecker(customFunction: () => void) {
        this.customAuthentificationRoleChecker = customFunction
    }

}