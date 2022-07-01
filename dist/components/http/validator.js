"use strict";
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
const express_validator_1 = require("express-validator");
exports.body = express_validator_1.body;
exports.query = express_validator_1.query;
const provider_1 = require("./provider");
exports.FormGenerator = (elements) => {
    let validations = [];
    for (let element in elements) {
        elements[element].builder.fields[0] = element;
        validations.push(elements[element]);
    }
    return validations;
};
exports.Form = () => {
    return (target) => {
        if (!Reflect.hasMetadata('validations', target)) {
            Reflect.defineMetadata('validations', {}, target);
        }
    };
};
exports.AddValidation = (cb) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor) || {};
        let validation = cb();
        validation.builder.fields[0] = propertyKey;
        validations.push(validation);
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.Body = () => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor) || {};
        validations[propertyKey] = express_validator_1.body();
        validations[propertyKey].builder.fields[0] = propertyKey;
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.Query = () => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor) || {};
        validations[propertyKey] = express_validator_1.query();
        validations[propertyKey].builder.fields[0] = propertyKey;
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldExist = () => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].exists().withMessage('api.form.errors.is_required');
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldBeNotEmpty = () => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].not().isEmpty().withMessage('api.form.errors.is_empty');
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldMatch = (regex) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].matches(regex);
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldBeEmail = (options) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].isEmail().withMessage('api.form.errors.is_not_email').normalizeEmail(options);
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldExistInModel = (model, column) => {
    return (target, propertyKey) => __awaiter(void 0, void 0, void 0, function* () {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].custom((value) => {
            model.findOne({ where: { [column]: value } }).then((el) => {
                if (!el) {
                    return Promise.reject("api.errors.not_found");
                }
                else {
                    return Promise.resolve();
                }
            });
        });
        Reflect.defineMetadata('validations', validations, target.constructor);
    });
};
exports.ShouldNotExistInModel = (model, column) => {
    return (target, propertyKey) => __awaiter(void 0, void 0, void 0, function* () {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].custom((value) => {
            model.findOne({ where: { [column]: value } }).then((el) => {
                if (el) {
                    return Promise.reject("api.errors.not_found");
                }
                else {
                    return Promise.resolve();
                }
            });
        });
        Reflect.defineMetadata('validations', validations, target.constructor);
    });
};
exports.ShouldCustom = (cb) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].custom(cb);
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldBeS3File = (s3, folder) => {
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
exports.ShouldBeEqualTo = (field) => {
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
exports.ShouldBeISO8601Date = () => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].isISO8601().withMessage('api.form.errors.not_valid_date').toDate();
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldHaveMinMaxLength = (min, max) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].isLength({ 'min': min, 'max': max }).withMessage('api.form.errors.not_valid_date');
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldHaveMinLength = (min) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].isLength({ 'min': min }).withMessage('api.form.errors.not_valid_date');
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldHaveMaxLength = (max) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].isLength({ 'max': max }).withMessage('api.form.errors.not_valid_date');
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldValidateForm = (form, exclude_validator = false) => {
    const validations = Reflect.getMetadata('validations', form);
    let arr = Object.values(validations);
    if (!exclude_validator) {
        arr.push((req, res, next) => {
            var errors = (express_validator_1.validationResult(req)).array();
            if (errors.length === 0) {
                next();
            }
            else {
                res.error({ status: 400, errors: errors });
            }
        });
    }
    return provider_1.Middleware(arr);
};
/**
 * @deprecated The method should not be used, use instead ShouldValidateForm
 */
exports.UseForm = exports.ShouldValidateForm;
exports.custom = {
    equalTo: (field, value, obj) => {
    },
    checkS3File: (s3, folder) => {
    }
};
//# sourceMappingURL=validator.js.map