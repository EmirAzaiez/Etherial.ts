"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EthLeafS3 = void 0;
require("reflect-metadata");
// const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const client_s3_1 = require("@aws-sdk/client-s3");
class EthLeafS3 {
    constructor({ access_key_id, secret_access_key, region, server, tenant_id, bucket }) {
        this.etherial_module_name = 'leaf_s3';
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
}
exports.EthLeafS3 = EthLeafS3;
//# sourceMappingURL=index.js.map