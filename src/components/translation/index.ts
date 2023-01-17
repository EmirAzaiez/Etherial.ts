import format from 'string-format' 
// import { Interceptor, InterceptorInterface, Action } from '../http/provider' 

export default class Translation {

    defaultLanguage?: String
    internalizations?: {}

    constructor({defaultLanguage, translations}) {
        this.defaultLanguage = defaultLanguage
        this.internalizations = {...require('../../../resources/components/translation/translation.json')}
            
        translations.forEach((translation) => {
            this.internalizations = {...this.internalizations, ...translation}
        })

        return this
    }

    error(error, lang) {

        let key = this.internalizations["FR"][error.msg]
        let keyp = this.internalizations["FR"][error.param]

        if (key) {

            let obj = {}

            if (keyp) {
                
                obj = {
                    code: 0,
                    location: error.location,
                    msg: format(key, {param: keyp, value: error.value}),
                    param_translated: keyp,
                    param: error.param
                }

            } else {

                obj = {
                    code: 0,
                    location: error.location,
                    msg: format(key, {param: error.param, value: error.value}),
                    param_translated: error.param,
                    param: error.param
                }

            }
            

            if ('code' in error) {
                //@ts-ignore
                obj.code = error.code
            }

            return obj
        } else {
            return error
        }

    }

    string(key, argumentss, lang) {

        let message = this.internalizations["FR"][key]

        if (message) {
            return format(message, argumentss)
        } else {
            return key
        }

    }

    run({http = undefined}) {

        if (http) {

            http.app.use((req, res, next) => {

                res.error = ({status = 400, error, errors}) => {

                    res.status(status)
        
                    var nerrors = []
        
                    if (error != undefined && typeof error == 'string') {
                        nerrors = [{location: 'api', param: '0', value: '0', msg: error}]
                    }
        
                    if (errors != undefined && errors instanceof Array) {
        
                        for (let index = 0; index < errors.length; index++) {
                            const error = errors[index]
        
                            if (typeof error == 'string') {
                                nerrors.push({location: 'api', param: '0', value: '0', msg: error})
                            } else {
                                nerrors.push(error)
                            }
                            
                        }
        
                    }

                    for (let index2 = 0; index2 < nerrors.length; index2++) {
                        nerrors[index2] = this.error(nerrors[index2], req.headers['accept-language'])
                    }
        
                    res.json({status: status, errors: nerrors})

                }

                next();

            })

        }

    }

}