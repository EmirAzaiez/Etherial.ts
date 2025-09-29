import etherial from '../../../../index'

import { EtherialYup } from '../../../../components/http/yup.validator'

import { GetObjectCommand } from '@aws-sdk/client-s3'

declare module 'yup' {
    interface StringSchema {
        shouldBeS3File(folder: string, message?: string): StringSchema
    }
}

EtherialYup.addMethod(EtherialYup.string, 'shouldBeS3File', function (folder: string, message: string = 'api.form.errors.file_not_exist') {
    return this.test('shouldBeS3File', message, async function (value) {
        if (value === undefined || value === null) return true

        try {
            const eal = etherial.leaf_s3

            await eal.s3.send(
                new GetObjectCommand({
                    Bucket: eal.bucket,
                    Key: folder + '/' + value,
                })
            )

            return true
        } catch (error) {
            return false
        }
    })
})

export const EtherialYupS3 = EtherialYup
