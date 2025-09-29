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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EtherialYupS3 = void 0;
const index_1 = __importDefault(require("../../../../index"));
const yup_validator_1 = require("../../../../components/http/yup.validator");
const client_s3_1 = require("@aws-sdk/client-s3");
yup_validator_1.EtherialYup.addMethod(yup_validator_1.EtherialYup.string, 'shouldBeS3File', function (folder, message = 'api.form.errors.file_not_exist') {
    return this.test('shouldBeS3File', message, function (value) {
        return __awaiter(this, void 0, void 0, function* () {
            if (value === undefined || value === null)
                return true;
            try {
                const eal = index_1.default.leaf_s3;
                yield eal.s3.send(new client_s3_1.GetObjectCommand({
                    Bucket: eal.bucket,
                    Key: folder + '/' + value,
                }));
                return true;
            }
            catch (error) {
                return false;
            }
        });
    });
});
exports.EtherialYupS3 = yup_validator_1.EtherialYup;
//# sourceMappingURL=yup.validator.js.map