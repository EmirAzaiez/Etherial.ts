import 'reflect-metadata'

// import * as AWS from "aws-sdk";

import { IEtherialModule } from "../../index.js"

// const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

import { S3Client } from "@aws-sdk/client-s3";


export class EthLeafS3 implements IEtherialModule {

    etherial_module_name: string = 'leaf_s3'

    s3: S3Client;
    bucket: string;
    server: string;
    tenant_id?: string;

    constructor({ access_key_id, secret_access_key, region, server, tenant_id, bucket }) {
        this.server = server;
        this.tenant_id = tenant_id;
        this.bucket = bucket;
    
        this.s3 = new S3Client({
            endpoint: server,
            region: region,
            credentials: {
                accessKeyId: access_key_id,
                secretAccessKey: secret_access_key,
            },
        });
    }

}