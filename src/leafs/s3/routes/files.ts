import etherial from '../../../index'

import * as mime from 'mime-types'
import uniqid, { time, process } from 'uniqid'

import * as FileRequestForm from '../forms/file_request_form'
// const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand } from '@aws-sdk/client-s3'

// PutObjectCommandInput

export const FileRequestRoute = () => {
    const eal = etherial.leaf_s3

    return async (req: { form: FileRequestForm.Create }, res, next) => {
        let filename = `${time()}${uniqid()}${process()}`

        if (req.form.filename) {
            filename = req.form.filename
        }

        let extension = mime.extension(req.form.content_type)
        let path = `${req.form.folder}/${filename}.${extension}`

        const command = new PutObjectCommand({
            Bucket: eal.bucket,
            Key: path,
            ACL: req.form.private === true ? 'private' : 'public-read',
            ContentType: req.form.content_type,
        })

        const url = await getSignedUrl(eal.s3, command, { expiresIn: 60 * 15 })

        let purl = ''

        if (eal.server.includes('contabo')) {
            purl = `${eal.server}/${eal.tenant_id}:${eal.bucket}`
        } else {
            purl = `${eal.server}/${eal.bucket}`
        }

        res.success({
            status: 200,
            data: {
                url: url,
                filename: filename,
                extension: extension,
                path: path,
                public_url: `${purl}/${path}`,
                file: `${filename}.${extension}`,
            },
        })
    }
}
