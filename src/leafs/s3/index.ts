import 'reflect-metadata'

import { IEtherialModule } from "../../index.js"

import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

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

    commands() {

        return [
            {
                command: 'cors',
                description: 'Configure cors for *.',
                warn: true,
                action: async () => {
                    try {

                        const pbcc = new PutBucketCorsCommand({
                            Bucket: this.bucket,
                            CORSConfiguration: {
                                CORSRules: [
                                    {
                                        AllowedHeaders: ["*"],
                                        AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
                                        AllowedOrigins: ["*"],
                                        ExposeHeaders: ["ETag"],
                                        MaxAgeSeconds: 3000
                                    }
                                ]
                            }
                        })

                        return await this.s3.send(pbcc)

                    } catch (error) {
                        return { success: false, message: error.message }
                    }
                }
            },

        ]

    }

}