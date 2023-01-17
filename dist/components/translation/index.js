"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const string_format_1 = __importDefault(require("string-format"));
// import { Interceptor, InterceptorInterface, Action } from '../http/provider' 
class Translation {
    constructor({ defaultLanguage, translations }) {
        this.defaultLanguage = defaultLanguage;
        this.internalizations = Object.assign({}, require('../../../resources/components/translation/translation.json'));
        translations.forEach((translation) => {
            this.internalizations = Object.assign(Object.assign({}, this.internalizations), translation);
        });
        return this;
    }
    error(error, lang) {
        let key = this.internalizations["FR"][error.msg];
        let keyp = this.internalizations["FR"][error.param];
        if (key && keyp) {
            var obj = {
                code: 0,
                msg: (0, string_format_1.default)(key, { param: keyp, value: error.value }),
                param: keyp
            };
            if ('code' in error) {
                obj.code = error.code;
            }
            return obj;
        }
        else {
            return error;
        }
    }
    string(key, argumentss, lang) {
        let message = this.internalizations["FR"][key];
        if (message) {
            return (0, string_format_1.default)(message, argumentss);
        }
        else {
            return key;
        }
    }
    run({ http = undefined }) {
        if (http) {
            http.app.use((req, res, next) => {
                res.error = ({ status = 400, error, errors }) => {
                    res.status(status);
                    var nerrors = [];
                    if (error != undefined && typeof error == 'string') {
                        nerrors = [{ location: 'api', param: '0', value: '0', msg: error }];
                    }
                    if (errors != undefined && errors instanceof Array) {
                        for (let index = 0; index < errors.length; index++) {
                            const error = errors[index];
                            if (typeof error == 'string') {
                                nerrors.push({ location: 'api', param: '0', value: '0', msg: error });
                            }
                            else {
                                nerrors.push(error);
                            }
                        }
                    }
                    for (let index2 = 0; index2 < nerrors.length; index2++) {
                        nerrors[index2] = this.error(nerrors[index2], req.headers['accept-language']);
                    }
                    res.json({ status: status, errors: nerrors });
                };
                next();
            });
        }
    }
}
exports.default = Translation;
//# sourceMappingURL=index.js.map