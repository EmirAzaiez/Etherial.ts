"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UseForm = exports.ShouldValidateForm = exports.ShouldBeMobilePhone = exports.ShouldHaveMaxLength = exports.ShouldHaveMinLength = exports.ShouldHaveMinMaxLength = exports.ShouldBeISO8601Date = exports.ShouldBeEqualTo = exports.ShouldBeS3File = exports.ShouldCustom = exports.ShouldNotExistInModel = exports.ShouldExistInModel = exports.ShouldBeEmail = exports.ShouldMatch = exports.ShouldBeNotEmpty = exports.ShouldExist = exports.Query = exports.Body = exports.AddValidation = exports.Form = exports.FormGenerator = exports.query = exports.body = void 0;
const express_validator_1 = require("express-validator");
Object.defineProperty(exports, "body", { enumerable: true, get: function () { return express_validator_1.body; } });
Object.defineProperty(exports, "query", { enumerable: true, get: function () { return express_validator_1.query; } });
const provider_1 = require("./provider");
const FormGenerator = (elements) => {
    let validations = [];
    for (let element in elements) {
        elements[element].builder.fields[0] = element;
        validations.push(elements[element]);
    }
    return validations;
};
exports.FormGenerator = FormGenerator;
const Form = () => {
    return (target) => {
        if (!Reflect.hasMetadata('validations', target)) {
            Reflect.defineMetadata('validations', {}, target);
        }
    };
};
exports.Form = Form;
const AddValidation = (cb) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor) || {};
        let validation = cb();
        validation.builder.fields[0] = propertyKey;
        validations.push(validation);
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.AddValidation = AddValidation;
const Body = () => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor) || {};
        validations[propertyKey] = (0, express_validator_1.body)();
        validations[propertyKey].builder.fields[0] = propertyKey;
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.Body = Body;
const Query = () => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor) || {};
        validations[propertyKey] = (0, express_validator_1.query)();
        validations[propertyKey].builder.fields[0] = propertyKey;
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.Query = Query;
const ShouldExist = () => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].exists().withMessage('api.form.errors.is_required');
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldExist = ShouldExist;
const ShouldBeNotEmpty = () => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].not().isEmpty().withMessage('api.form.errors.is_empty');
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldBeNotEmpty = ShouldBeNotEmpty;
const ShouldMatch = (regex) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].matches(regex);
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldMatch = ShouldMatch;
const ShouldBeEmail = (options) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].isEmail().withMessage('api.form.errors.is_not_email').normalizeEmail(options);
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldBeEmail = ShouldBeEmail;
const ShouldExistInModel = (model, column) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].custom((value) => {
            return new Promise((resolve, reject) => {
                model.findOne({ where: { [column]: value } }).then((el) => {
                    if (!el) {
                        return reject("api.errors.not_found");
                    }
                    else {
                        return resolve(true);
                    }
                });
            });
        });
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldExistInModel = ShouldExistInModel;
const ShouldNotExistInModel = (model, column) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].custom((value) => {
            return new Promise((resolve, reject) => {
                model.findOne({ where: { [column]: value } }).then((el) => {
                    if (el) {
                        return reject("api.errors.not_found");
                    }
                    else {
                        return resolve(true);
                    }
                });
            });
        });
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldNotExistInModel = ShouldNotExistInModel;
const ShouldCustom = (cb) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].custom(cb);
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldCustom = ShouldCustom;
const ShouldBeS3File = (s3, folder) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].custom((value) => {
            return new Promise((resolve, reject) => {
                s3.getObject({
                    Bucket: process.env.AWS_BUCKET,
                    Key: folder + '/' + value
                }, (err) => {
                    if (err) {
                        reject('api.form.errors.file_not_exist');
                    }
                    else {
                        resolve(true);
                    }
                });
            });
        });
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldBeS3File = ShouldBeS3File;
const ShouldBeEqualTo = (field) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].custom((value, obj) => {
            if (value !== obj.req.body[field]) {
                throw new Error('api.form.errors.not_equal_to_' + field);
            }
            else {
                return value;
            }
        });
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldBeEqualTo = ShouldBeEqualTo;
const ShouldBeISO8601Date = () => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].isISO8601().withMessage('api.form.errors.not_valid_date').toDate();
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldBeISO8601Date = ShouldBeISO8601Date;
const ShouldHaveMinMaxLength = (min, max) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].isLength({ 'min': min, 'max': max }).withMessage('api.form.errors.min_max_length_not_valid');
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldHaveMinMaxLength = ShouldHaveMinMaxLength;
const ShouldHaveMinLength = (min) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].isLength({ 'min': min }).withMessage('api.form.errors.min_length_not_valid');
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldHaveMinLength = ShouldHaveMinLength;
const ShouldHaveMaxLength = (max) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].isLength({ 'max': max }).withMessage('api.form.errors.max_length_not_valid');
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldHaveMaxLength = ShouldHaveMaxLength;
const ShouldBeMobilePhone = (locale) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].isMobilePhone(locale).withMessage('api.form.errors.max_length_not_valid');
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldBeMobilePhone = ShouldBeMobilePhone;
const ShouldValidateForm = (form, { exclude_validator = false, include_optionals = true }) => {
    const validations = Reflect.getMetadata('validations', form);
    let arr = Object.values(validations);
    if (!exclude_validator) {
        arr.push((req, res, next) => {
            var errors = ((0, express_validator_1.validationResult)(req)).array();
            if (errors.length === 0) {
                req.form = (0, express_validator_1.matchedData)(req, {
                    includeOptionals: include_optionals,
                });
                next();
            }
            else {
                res.error({ status: 400, errors: errors });
            }
        });
    }
    return (0, provider_1.Middleware)(arr);
};
exports.ShouldValidateForm = ShouldValidateForm;
/**
 * @deprecated The method should not be used, use instead ShouldValidateForm
 */
exports.UseForm = exports.ShouldValidateForm;
//# sourceMappingURL=validator.js.map