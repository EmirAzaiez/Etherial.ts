var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as yup from 'yup';
import { Middleware } from './provider';
yup.addMethod(yup.mixed, 'shouldNotExistInModel', function (model, column, message = 'api.form.errors.already_exist_in_database') {
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
const deriveInstanceKeyFromPath = (path) => {
    if (!path)
        return '_instance';
    if (path.endsWith('_id'))
        return path.slice(0, -3);
    if (path.endsWith('Id'))
        return path.slice(0, -2);
    if (path.endsWith('ID'))
        return path.slice(0, -2);
    return `${path}_instance`;
};
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
            var _a;
            if (value === undefined || value === null)
                return true;
            try {
                const existingRecord = yield model.findOne({ where: { [column]: value } });
                if (existingRecord) {
                    const aliasKey = deriveInstanceKeyFromPath(this.path);
                    this.parent._modelInstances = this.parent._modelInstances || {};
                    this.parent._modelInstances[this.path] = existingRecord;
                    this.parent._modelInstances[aliasKey] = existingRecord;
                    const ctx = (_a = this.options) === null || _a === void 0 ? void 0 : _a.context;
                    if (ctx) {
                        ctx._modelInstances = ctx._modelInstances || {};
                        ctx._modelInstances[this.path] = existingRecord;
                        ctx._modelInstances[aliasKey] = existingRecord;
                    }
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
            var _a;
            if (value === undefined || value === null)
                return true;
            try {
                const existingRecord = yield model.findOne({ where: { [column]: value } });
                if (existingRecord) {
                    const aliasKey = deriveInstanceKeyFromPath(this.path);
                    this.parent._modelInstances = this.parent._modelInstances || {};
                    this.parent._modelInstances[this.path] = existingRecord;
                    this.parent._modelInstances[aliasKey] = existingRecord;
                    const ctx = (_a = this.options) === null || _a === void 0 ? void 0 : _a.context;
                    if (ctx) {
                        ctx._modelInstances = ctx._modelInstances || {};
                        ctx._modelInstances[this.path] = existingRecord;
                        ctx._modelInstances[aliasKey] = existingRecord;
                    }
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
export const EtherialYup = yup;
export const { object, string, number, boolean, date, array, mixed } = yup;
export const ShouldValidateYupForm = (schema, location = 'body') => {
    if (location != 'body' && location != 'query' && location != 'params') {
        throw new Error('ShouldValidateYupForm: Invalid location');
    }
    return Middleware((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const yupContext = { _modelInstances: {} };
            const validatedData = yield schema.validate(req[location], { abortEarly: false, strict: true, stripUnknown: true, context: yupContext });
            req.form = Object.assign(Object.assign({}, req.form), validatedData);
            const instances = (yupContext === null || yupContext === void 0 ? void 0 : yupContext._modelInstances) || {};
            for (const key in instances) {
                if (!(key in validatedData)) {
                    req.form[key] = instances[key];
                }
            }
            next();
        }
        catch (error) {
            res.error({ status: 400, errors: error.errors });
        }
    }));
};
/**
 * @deprecated The method should not be used, use instead ShouldValidateYupForm
 */
export const UseYupForm = ShouldValidateYupForm;
