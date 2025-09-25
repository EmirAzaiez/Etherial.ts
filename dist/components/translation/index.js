"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Translation = void 0;
function format(str, data) {
    return str.replace(/\{([^}]+)\}/g, (match, key) => {
        const keys = key.split('[').map((part) => part.replace(']', ''));
        let value = data;
        for (const k of keys) {
            value = value[k];
            if (value === undefined) {
                break; // Stop if any key is undefined
            }
        }
        return value !== undefined ? value : match;
    });
}
class Translation {
    constructor({ defaultLanguage, translations }) {
        this.etherial_module_name = 'translation';
        this.defaultLanguage = defaultLanguage;
        this.internalizations = {
            EN: require('../../../resources/components/translation/translation.json'),
        };
        translations.forEach((translation) => {
            this.internalizations = Object.assign(Object.assign({}, this.internalizations), { [translation.lang]: Object.assign(Object.assign({}, this.internalizations[translation.lang]), translation.internalization) });
        });
        return this;
    }
    error(error, lang) {
        let key = this.internalizations[lang][error.msg];
        if (key) {
            if (error.params) {
                let keyp = error.params.map((param) => this.internalizations[lang][param]);
                if (keyp.every((element) => element !== undefined)) {
                    return format(key, { params: keyp, value: error.value });
                }
            }
            return format(key, { params: error.params, value: error.value });
        }
        else {
            return error;
        }
    }
    // string(key, argumentss, lang) {
    //     let message = this.internalizations["FR"][key]
    //     if (message) {
    //         return format(message, argumentss)
    //     } else {
    //         return key
    //     }
    // }
    run({ http = undefined }) {
        if (http) {
            http.app.use((req, res, next) => {
                let userLang = this.defaultLanguage || 'EN';
                if (req.headers['accept-language']) {
                    try {
                        userLang = req.headers['accept-language'].split(',')[0].toUpperCase();
                    }
                    catch (e) { }
                }
                // @ts-ignore
                if (this.internalizations[userLang] == undefined) {
                    userLang = 'EN';
                }
                res.error = ({ status = 400, error, errors }) => {
                    var nerrors = [];
                    // if (error != undefined && typeof error == 'string') {
                    //     nerrors = [{location: 'api', param: '0', value: '0', msg: error}]
                    // }
                    if (errors != undefined && errors instanceof Array) {
                        for (let index = 0; index < errors.length; index++) {
                            const error = errors[index];
                            if (typeof error == 'string') {
                                nerrors.push({ msg: error });
                            }
                            else {
                                nerrors.push(error);
                            }
                        }
                    }
                    for (let index2 = 0; index2 < nerrors.length; index2++) {
                        nerrors[index2] = this.error(nerrors[index2], userLang);
                    }
                    res.status(status).json({ status: status, errors: nerrors });
                };
                next();
            });
        }
    }
}
exports.Translation = Translation;
//# sourceMappingURL=index.js.map