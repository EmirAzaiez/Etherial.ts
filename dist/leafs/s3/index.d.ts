import 'reflect-metadata';
import { IEtherialModule } from '../../index.js';
import { S3Client } from '@aws-sdk/client-s3';
export declare class EthLeafS3 implements IEtherialModule {
    etherial_module_name: string;
    s3: S3Client;
    bucket: string;
    server: string;
    tenant_id?: string;
    constructor({ access_key_id, secret_access_key, region, server, tenant_id, bucket }: EthLeafS3Config);
    commands(): {
        command: string;
        description: string;
        warn: boolean;
        action: () => Promise<import("@aws-sdk/client-s3").PutBucketCorsCommandOutput | {
            success: boolean;
            message: any;
        }>;
    }[];
}
export interface EthLeafS3Config {
    access_key_id: string;
    secret_access_key: string;
    region: string;
    server: string;
    tenant_id?: string;
    bucket: string;
}
