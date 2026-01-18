var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from '../../../index.js';
import * as mime from 'mime-types';
import uniqid, { time, process } from 'uniqid';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
export const FileRequestRoute = ({ allowCustomFilename = false, shouldBePrivate = false, authorizedFolders = [] } = {}) => {
    const eal = etherial.leaf_s3;
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        let filename = `${time()}${uniqid()}${process()}`;
        if (authorizedFolders.length > 0 && !authorizedFolders.includes(req.form.folder)) {
            return res.error({
                status: 400,
                errors: ['Invalid folder'],
            });
        }
        let extension = mime.extension(req.form.content_type);
        if (allowCustomFilename && req.form.filename) {
            filename = req.form.filename;
        }
        let path = `${req.form.folder}/${filename}.${extension}`;
        const command = new PutObjectCommand({
            Bucket: eal.bucket,
            Key: path,
            ACL: shouldBePrivate === true ? 'private' : 'public-read',
            ContentType: req.form.content_type,
        });
        const url = yield getSignedUrl(eal.s3, command, { expiresIn: 60 * 15 });
        let purl = '';
        if (eal.server.includes('contabo')) {
            purl = `${eal.server}/${eal.tenant_id}:${eal.bucket}`;
        }
        else {
            purl = `${eal.server}/${eal.bucket}`;
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
        });
    });
};
