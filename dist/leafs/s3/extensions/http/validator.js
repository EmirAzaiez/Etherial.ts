"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShouldBeS3File = void 0;
const index_1 = __importDefault(require("../../../../index"));
const client_s3_1 = require("@aws-sdk/client-s3");
const ShouldBeS3File = (folder) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].custom((value) => {
            return new Promise((resolve, reject) => {
                const eal = index_1.default.leaf_s3;
                eal.s3.send(new client_s3_1.GetObjectCommand({
                    Bucket: eal.bucket,
                    Key: folder + '/' + value
                })).then(() => {
                    resolve(true);
                }).catch(() => {
                    reject('api.form.errors.file_not_exist');
                });
            });
        });
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
exports.ShouldBeS3File = ShouldBeS3File;
//# sourceMappingURL=validator.js.map