import { validationResult, body, query, ValidationChain } from 'express-validator'

import { Middleware } from './provider'

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

export const Form = () : ClassDecorator => {

    return (target: any) => {
  
        if (!Reflect.hasMetadata('validations', target)) {
            Reflect.defineMetadata('validations', {}, target);
        }

    };

};

export const AddValidation = (cb) : PropertyDecorator => {

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

export const ShouldMatch = (regex) : PropertyDecorator => {

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

export const ShouldCustom = (cb) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].custom(cb)

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}

export const ShouldBeS3File = (s3, folder) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].custom((value) => {
            
            return new Promise((resolve, reject) => {

                s3.getObject({
                    Bucket: process.env.AWS_BUCKET,
                    Key: folder + '/' + value
                },  (err) => {
    
                    if(err) {
                        reject('api.form.errors.file_not_exist')
                    } else {
                        resolve(true)
                    }
                    
                })
    
            })

        })

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}

export const ShouldBeEqualTo = (field) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].custom((value, obj) => {
            
            if (value !== obj.req.body[field]) {
                throw new Error('api.form.errors.not_equal_to_' + field)
            } else {
                return value
            }

        })

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

export const UseForm = (form, exclude_validator = false) => {

    const validations = Reflect.getMetadata('validations', form);

    let arr = Object.values(validations)

    if (!exclude_validator) {
        arr.push((req, res, next) => {
            var errors = (validationResult(req)).array()
    
            if(errors.length === 0) {
                next()
            } else {
                res.error({status: 400, errors: errors})
            }
        })
    }

    return Middleware(arr)
    
}

export const custom = {
    equalTo:  (field, value, obj) => {
        
    },
    checkS3File:  (s3, folder) => {
        

    }
}