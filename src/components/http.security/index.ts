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

    constructor({ secret, authorizedRoutes, type, model }) {
        this.secret = secret
        this.authorizedRoutes = authorizedRoutes
        this.type = type
        this.model = model

        if (this.type === 'JWT') {

            this.generateToken = (data: {}) => {
                return jwt.sign(data, this.secret) as String
            }

            this.authentificatorMiddleware = async (req, res, next) => {

                let token = req.headers["authorization"];
        
                if (token.startsWith("Bearer ")) {
                    let decoded = jwt.decode(token.substring(7, token.length), this.secret);
        
                    if (decoded) {
                        let user = await model.findOne({where: {'id': decoded.user_id} });
        
                        if (user != null) {
                            req.user = user
                            return next(false)
                        }
        
                    } else {
                        res.error({status: 401, errors: ['forbidden']})
                    }
        
                } else {
                    res.error({status: 401, errors: ['forbidden']})
                }
            
            }
            
            this.authentificatorRoleCheckerMiddleware = (role: number = 0) => {
                return (req, res, next) => {

                    if (req.user.role >= role) {
                        next(null)
                    } else {
                        res.error({status: 401, errors: ['forbidden']})
                    }

                }

            }

        }

    }

}