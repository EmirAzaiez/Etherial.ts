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
exports.UseYupForm = exports.ShouldValidateYupForm = exports.mixed = exports.array = exports.date = exports.boolean = exports.number = exports.string = exports.object = exports.EtherialYup = void 0;
const yup = __importStar(require("yup"));
const provider_1 = require("./provider");
yup.addMethod(yup.number, 'shouldNotExistInModel', function (model, column, message = 'api.form.errors.already_exist_in_database') {
    return this.test('shouldNotExistInModel', message, function (value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (value === undefined || value === null)
                return true;
            try {
                const existingRecord = yield model.findOne({ where: { [column]: value } });
                return !existingRecord;
            }
            catch (error) {
                return this.createError({ message: 'Database error during validation' });
            }
        });
    });
});
yup.addMethod(yup.number, 'shouldExistInModel', function (model, column, message = 'api.form.errors.not_found_in_database') {
    return this.test('shouldExistInModel', message, function (value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (value === undefined || value === null)
                return true;
            try {
                const existingRecord = yield model.findOne({ where: { [column]: value } });
                if (existingRecord) {
                    this.parent._modelInstances = this.parent._modelInstances || {};
                    this.parent._modelInstances[this.path] = existingRecord;
                    return true;
                }
                return false;
            }
            catch (error) {
                return this.createError({ message: 'Database error during validation' });
            }
        });
    });
});
yup.addMethod(yup.string, 'shouldNotExistInModel', function (model, column, message = 'api.form.errors.already_exist_in_database') {
    return this.test('shouldNotExistInModel', message, function (value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (value === undefined || value === null)
                return true;
            try {
                const existingRecord = yield model.findOne({ where: { [column]: value } });
                return !existingRecord;
            }
            catch (error) {
                return this.createError({ message: 'Database error during validation' });
            }
        });
    });
});
yup.addMethod(yup.string, 'shouldExistInModel', function (model, column, message = 'api.form.errors.not_found_in_database') {
    return this.test('shouldExistInModel', message, function (value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (value === undefined || value === null)
                return true;
            try {
                const existingRecord = yield model.findOne({ where: { [column]: value } });
                if (existingRecord) {
                    this.parent._modelInstances = this.parent._modelInstances || {};
                    this.parent._modelInstances[this.path] = existingRecord;
                    return true;
                }
                return false;
            }
            catch (error) {
                return this.createError({ message: 'Database error during validation' });
            }
        });
    });
});
yup.addMethod(yup.string, 'shouldMatchField', function (fieldName, message = 'Fields do not match') {
    return this.test('shouldMatchField', message, function (value) {
        const otherValue = this.parent[fieldName];
        return value === otherValue;
    });
});
yup.addMethod(yup.string, 'shouldBeStrongPassword', function (message = 'Password is not strong enough') {
    return this.test('shouldBeStrongPassword', message, function (value) {
        if (!value)
            return true;
        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return strongPasswordRegex.test(value);
    });
});
exports.EtherialYup = yup;
exports.object = yup.object, exports.string = yup.string, exports.number = yup.number, exports.boolean = yup.boolean, exports.date = yup.date, exports.array = yup.array, exports.mixed = yup.mixed;
const ShouldValidateYupForm = (schema, location = 'body') => {
    if (location != 'body' && location != 'query' && location != 'params') {
        throw new Error('ShouldValidateYupForm: Invalid location');
    }
    return (0, provider_1.Middleware)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const validatedData = yield schema.validate(req[location], { abortEarly: false, strict: true, stripUnknown: true });
            req.form = [...req.form, ...validatedData];
            next();
        }
        catch (error) {
            res.error({ status: 400, errors: error.errors });
        }
    }));
};
exports.ShouldValidateYupForm = ShouldValidateYupForm;
/**
 * @deprecated The method should not be used, use instead ShouldValidateYupForm
 */
exports.UseYupForm = exports.ShouldValidateYupForm;
//# sourceMappingURL=yup.validator.js.map