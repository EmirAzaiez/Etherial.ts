import 'reflect-metadata';
import { IEtherialModule } from "../../index.js";
import { S3Client } from "@aws-sdk/client-s3";
export declare class EthLeafS3 implements IEtherialModule {
    etherial_module_name: string;
    s3: S3Client;
    bucket: string;
    server: string;
    tenant_id?: string;
    constructor({ access_key_id, secret_access_key, region, server, tenant_id, bucket }: {
        access_key_id: any;
        secret_access_key: any;
        region: any;
        server: any;
        tenant_id: any;
        bucket: any;
    });
}
