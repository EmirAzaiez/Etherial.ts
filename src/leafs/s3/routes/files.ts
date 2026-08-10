import etherial from '../../../index.js'

import * as mime from 'mime-types'
import uniqid, { time, process } from 'uniqid'

import * as FileRequestForm from '../forms/file_request_form.js'

import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand } from '@aws-sdk/client-s3'

import type { RequestHandler } from 'express'

interface FileRequestRouteParams {
    allowCustomFilename?: boolean
    shouldBePrivate?: boolean
    authorizedFolders?: string[]
}

// The return type is explicitly `RequestHandler` so the route can be handed to
// `@ShouldUseRoute(...)` — inferring `(req: { form: Create }) => ...` made it
// unassignable to express' handler signature on the consumer side.
export const FileRequestRoute = ({ allowCustomFilename = false, shouldBePrivate = false, authorizedFolders = [] }: FileRequestRouteParams = {}): RequestHandler => {
    const eal = etherial.leaf_s3

    return async (req: any, res: any, next: any) => {
        const form: FileRequestForm.Create = req.form

        let filename = `${time()}${uniqid()}${process()}`

        if (authorizedFolders.length > 0 && !authorizedFolders.includes(form.folder)) {
            return res.error({
                status: 400,
                errors: ['Invalid folder'],
            })
        }

        let extension = mime.extension(form.content_type)

        if (allowCustomFilename && form.filename) {
            filename = form.filename
        }

        let path = `${form.folder}/${filename}.${extension}`

        const command = new PutObjectCommand({
            Bucket: eal.bucket,
            Key: path,
            ACL: shouldBePrivate === true ? 'private' : 'public-read',
            ContentType: form.content_type,
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
