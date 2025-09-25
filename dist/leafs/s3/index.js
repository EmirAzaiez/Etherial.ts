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
exports.EthLeafS3 = void 0;
require("reflect-metadata");
const client_s3_1 = require("@aws-sdk/client-s3");
class EthLeafS3 {
    constructor({ access_key_id, secret_access_key, region, server, tenant_id, bucket }) {
        this.etherial_module_name = 'leaf_s3';
        if (!access_key_id || !secret_access_key || !region || !server || !bucket) {
            throw new Error('EthLeafS3 config is not valid.');
        }
        this.server = server;
        this.tenant_id = tenant_id;
        this.bucket = bucket;
        this.s3 = new client_s3_1.S3Client({
            endpoint: server,
            region: region,
            credentials: {
                accessKeyId: access_key_id,
                secretAccessKey: secret_access_key,
            },
        });
    }
    commands() {
        return [
            {
                command: 'cors',
                description: 'Configure cors for *.',
                warn: true,
                action: () => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const pbcc = new client_s3_1.PutBucketCorsCommand({
                            Bucket: this.bucket,
                            CORSConfiguration: {
                                CORSRules: [
                                    {
                                        AllowedHeaders: ['*'],
                                        AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                                        AllowedOrigins: ['*'],
                                        ExposeHeaders: ['ETag'],
                                        MaxAgeSeconds: 3000,
                                    },
                                ],
                            },
                        });
                        return yield this.s3.send(pbcc);
                    }
                    catch (error) {
                        return { success: false, message: error.message };
                    }
                }),
            },
        ];
    }
}
exports.EthLeafS3 = EthLeafS3;
//# sourceMappingURL=index.js.map