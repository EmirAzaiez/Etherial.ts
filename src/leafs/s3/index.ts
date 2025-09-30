import 'reflect-metadata'

import { IEtherialModule } from '../../index.js'

import { DeleteObjectCommand, DeleteObjectCommandOutput, PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3'

export class EthLeafS3 implements IEtherialModule {
    etherial_module_name: string = 'leaf_s3'

    s3: S3Client
    bucket: string
    server: string
    tenant_id?: string
    deleteUnusedFiles: () => void

    constructor({ access_key_id, secret_access_key, region, server, tenant_id, bucket }: EthLeafS3Config) {
        if (!access_key_id || !secret_access_key || !region || !server || !bucket) {
            throw new Error('EthLeafS3 config is not valid.')
        }

        this.server = server
        this.tenant_id = tenant_id
        this.bucket = bucket

        this.s3 = new S3Client({
            endpoint: server,
            region: region,
            credentials: {
                accessKeyId: access_key_id,
                secretAccessKey: secret_access_key,
            },
        })
    }

    async deleteFile(folder: string, file: string): Promise<DeleteObjectCommandOutput> {
        const cmd = new DeleteObjectCommand({ Bucket: this.bucket, Key: `${folder}/${file}` })

        return await this.s3.send(cmd)
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
                                        AllowedHeaders: ['*'],
                                        AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                                        AllowedOrigins: ['*'],
                                        ExposeHeaders: ['ETag'],
                                        MaxAgeSeconds: 3000,
                                    },
                                ],
                            },
                        })

                        return await this.s3.send(pbcc)
                    } catch (error) {
                        return { success: false, message: error.message }
                    }
                },
            },
        ]
    }
}

export interface EthLeafS3Config {
    access_key_id: string
    secret_access_key: string
    region: string
    server: string
    tenant_id?: string
    bucket: string
}
