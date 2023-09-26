import { validationResult, body, query, ValidationChain, matchedData } from 'express-validator'

import { Middleware, Request } from './provider'

export { ValidationChain }
export { body }
export { query }

export const FormGenerator = (elements) => {

    let validations = []

    for (let element in elements) {
        elements[element].builder.fields[0] = element
        validations.push(elements[element])
    }

    return validations

}

export const Form = (name?: string) : ClassDecorator => {

    return (target: any) => {
  
        if (!Reflect.hasMetadata('validations', target)) {
            Reflect.defineMetadata('validations', {}, target);
        }

        if (!Reflect.hasMetadata('instances_of_model', target)) {
            Reflect.defineMetadata('instances_of_model', {}, target);
        }

    };

};

export const AddValidation = (cb: () => any) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {
  
        let validations = Reflect.getMetadata('validations', target.constructor) || {};

        let validation = cb()

        validation.builder.fields[0] = propertyKey

        validations.push(validation)

        Reflect.defineMetadata('validations', validations, target.constructor);

    };

};

export const Body = () : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor) || {};

        validations[propertyKey] = body()

        validations[propertyKey].builder.fields[0] = propertyKey

        Reflect.defineMetadata('validations', validations, target.constructor);

    };

}

export const Query = () : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor) || {};

        validations[propertyKey] = query()

        validations[propertyKey].builder.fields[0] = propertyKey

        Reflect.defineMetadata('validations', validations, target.constructor);

    };

}

export const ModelInstance = (property) : PropertyDecorator => {
    
    return (target: any, propertyKey: string) => {

        let instances_of_model = Reflect.getMetadata('instances_of_model', target.constructor) || {}

        instances_of_model[property] = {
            rproperty: propertyKey, //user
            instance: null
        }

        Reflect.defineMetadata('instances_of_model', instances_of_model, target.constructor);

    };

}


export const ShouldBeOptional = () : PropertyDecorator => {
    
        return (target: any, propertyKey: string) => {
    
            let validations = Reflect.getMetadata('validations', target.constructor);
    
            validations[propertyKey] = validations[propertyKey].optional()
    
            Reflect.defineMetadata('validations', validations, target.constructor);
    
        };
    
    }

export const ShouldExist = () : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor);

        validations[propertyKey] = validations[propertyKey].exists().withMessage('api.form.errors.is_required')

        Reflect.defineMetadata('validations', validations, target.constructor);

    };

}

export const ShouldBeNotEmpty = () : PropertyDecorator => {

    return (target: any, propertyKey: string) => {
  
        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].not().isEmpty().withMessage('api.form.errors.is_empty')

        Reflect.defineMetadata('validations', validations, target.constructor);

    };

}

export const ShouldMatch = (regex: RegExp) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {
  
        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].matches(regex)

        Reflect.defineMetadata('validations', validations, target.constructor);

    };

}

export const ShouldBeEmail = (options) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {
  
        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].isEmail().withMessage('api.form.errors.is_not_email').normalizeEmail(options)

        Reflect.defineMetadata('validations', validations, target.constructor);

    };

}

export const ShouldBeArray = (options) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {
  
        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].isArray().withMessage('api.form.errors.is_not_array')

        Reflect.defineMetadata('validations', validations, target.constructor);

    };

}

export const ShouldExistInModel = (model: any, column: string) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].custom((value) => {

            return new Promise((resolve, reject) => { 

                model.findOne({where: { [column]: value }}).then((el) => {
                    
                    if (!el) {
                        return reject("api.form.errors.not_found_in_database");
                    } else {

                        let iom = Reflect.getMetadata('instances_of_model', target.constructor)
    
                        iom[propertyKey] = {
                            ...iom[propertyKey],
                            instance: el
                        }
                
                        Reflect.defineMetadata('instances_of_model', iom, target.constructor);

                        return resolve(true);
                    }

                });

            })

        })

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}

export const ShouldNotExistInModel = (model: any, column: string) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].custom((value) => {

            return new Promise((resolve, reject) => { 

                model.findOne({where: { [column]: value }}).then((el) => {

                    if (el) {
                        return reject("api.form.errors.already_exist_in_database");
                    } else {
                        return resolve(true);
                    }

                });

            })

        })

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}

export const ShouldValidateCustom = (cb: (value: string, meta: {req: Request, path: string}) => Promise<any>) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].custom(cb)

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}

export const ShouldSanitizeCustom = (cb: (value: string, meta: {req: Request, path: string}) => Promise<any>) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].customSanitizer(cb)

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}

export const ShouldSanitizeToLowerCase = () : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].toLowerCase()

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}

export const ShouldSanitizeToUpperCase = () : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].toUpperCase()

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}

export const ShouldSanitizeToDefaultValue = (value: string) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].default(value)

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}

export const ShouldBeEqualTo = (field: string) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].custom((value, obj) => {
            
            if (value !== obj.req.body[field]) {
                throw new Error('api.form.errors.not_equal')
            } else {
                return value
            }

        })

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}

export const ShouldBeBoolean = () : PropertyDecorator => {
        
        return (target: any, propertyKey: string) => {
    
            let validations = Reflect.getMetadata('validations', target.constructor)
    
            validations[propertyKey] = validations[propertyKey].isBoolean().withMessage('api.form.errors.not_boolean').toBoolean(true)
    
            Reflect.defineMetadata('validations', validations, target.constructor);
    
        }
    
    }

export const ShouldBeDate = (format: string) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].isDate({
            format: format,
            delimeters: ['/', '-'],
            strictMode: true
        }).withMessage('api.form.errors.not_valid_date').toDate()

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}

export const ShouldBeISO8601Date = () : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].isISO8601().withMessage('api.form.errors.not_valid_date').toDate()

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}

export const ShouldHaveMinMaxLength = (min: number, max: number) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].isLength({ 'min': min, 'max': max }).withMessage('api.form.errors.min_max_length_not_valid')

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}

export const ShouldHaveMinLength = (min: number) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].isLength({ 'min': min }).withMessage('api.form.errors.min_length_not_valid')

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}

export const ShouldHaveMaxLength = (max: number) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].isLength({ 'max': max }).withMessage('api.form.errors.max_length_not_valid')

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}

export const ShouldBeMobilePhone = (locale: string) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].isMobilePhone(locale).withMessage('api.form.errors.max_length_not_valid')

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}


type ShouldValidateFormOptions = {
    exclude_validator?: boolean
    include_optionals?: boolean
}

export const ShouldValidateForm = (form, options:ShouldValidateFormOptions = {exclude_validator: false, include_optionals: true}) => {

    const validations = Reflect.getMetadata('validations', form);

    let arr = Object.values(validations)

    if (!options.exclude_validator) {

        arr.push((req, res, next) => {

            var errors = (validationResult(req)).array().map((el) => {
                return {
                    params: [el.param], 
                    value: el.value, 
                    msg: el.msg
                }
            })

            if(errors.length === 0) {

                const instances_of_model = Reflect.getMetadata('instances_of_model', form);

                req.form = matchedData(req, {
                    includeOptionals: options.include_optionals,
                })

                for (let key in instances_of_model) {
                    req.form[instances_of_model[key]["rproperty"]] = instances_of_model[key]["instance"]
                }

                next()

            } else {
                res.error({status: 400, errors: errors})
            }
        })

    }

    return Middleware(arr)
    
}

/**
 * @deprecated The method should not be used, use instead ShouldValidateForm
 */
export const UseForm = ShouldValidateForm

/**
 * @deprecated The method should not be used, use instead ShouldValidateForm
 */
export const ShouldCustom = ShouldValidateCustom