import { Http } from '../http';

// import * as expressJWT from 'express-jwt'
import * as jwt from 'jsonwebtoken'

import { Middleware } from '../http/provider'

export default class HttpSecurity {

    type?: String;
    secret?: String;
    generateToken?: (data: any) => String
    authentificatorMiddleware: any
    authentificatorRoleCheckerMiddleware: any
    roles: any;
    column: string;
    role_column: string;
    customAuthentificationChecker: (any) => Promise<void>;
    customAuthentificationRoleChecker: (any) => void;

    constructor({ secret, type, roles, role_column }) {
        this.secret = secret
        this.type = type
        this.roles = roles
        this.role_column = role_column

        this.authentificatorRoleCheckerMiddleware = (role: string = "CLIENT") => {

            return (req, res, next) => {

                if (req.user) {

                    let checkrole = this.roles[role]

                    if (checkrole.includes(req.user[role_column])) {
                        next(null)
                    } else {
                        res.error({status: 401, errors: ['forbidden']})
                    }

                } else {

                    res.error({status: 401, errors: ['forbidden']})
                    
                }

            }

        }

        if (this.type === 'JWT') {

            this.generateToken = (data: {}) => {
                return jwt.sign(data, this.secret) as String
            }

            this.authentificatorMiddleware = async (req, res, next) => {

                if (req.user) {
                    return next()
                }

                let token = req.headers["authorization"];
        
                if (token && token.startsWith("Bearer ")) {
                    let decoded = jwt.decode(token.substring(7, token.length), this.secret);
        
                    if (decoded) {

                        this.customAuthentificationChecker(decoded.user_id).then((user) => {
                            req.user = user
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
            

        } else if (this.type === 'SESSION') {

        } else if (this.type === 'BASIC') {

        }

    }

    setCustomAuthentificationChecker(customFunction: (any) => Promise<void>) {
        this.customAuthentificationChecker = customFunction
    }

    setCustomAuthentificationRoleChecker(customFunction: () => void) {
        this.customAuthentificationRoleChecker = customFunction
    }

}