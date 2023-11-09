"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShouldBeS3File = void 0;
const index_1 = __importDefault(require("../../../index"));
const ShouldBeS3File = (folder) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].custom((value) => {
            return new Promise((resolve, reject) => {
                // @ts-ignore
                const eal = index_1.default.s3_leaf;
                eal.s3.getObject({
                    Bucket: eal.bucket,
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
//# sourceMappingURL=http.validator.js.map