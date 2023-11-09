"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileRequestRoute = void 0;
const index_1 = __importDefault(require("../../../index"));
const mime = __importStar(require("mime-types"));
const uniqid_1 = __importStar(require("uniqid"));
// const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const client_s3_1 = require("@aws-sdk/client-s3");
// PutObjectCommandInput
const FileRequestRoute = () => {
    const eal = index_1.default.s3_leaf;
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        let filename = `${(0, uniqid_1.time)()}${(0, uniqid_1.default)()}${(0, uniqid_1.process)()}`;
        let extension = mime.extension(req.form.content_type);
        let path = `${req.form.folder}/${filename}.${extension}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: eal.bucket,
            Key: path,
            ACL: (req.form.private === true ? "private" : "public-read"),
            ContentType: req.form.content_type,
        });
        const url = yield (0, s3_request_presigner_1.getSignedUrl)(eal.s3, command, { expiresIn: 60 * 15 });
        let purl = "";
        if (eal.server.includes("contabo")) {
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
                file: `${filename}.${extension}`
            },
        });
    });
};
exports.FileRequestRoute = FileRequestRoute;
//# sourceMappingURL=files.js.map