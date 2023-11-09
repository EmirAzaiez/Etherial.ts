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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFileAccessForPut = void 0;
const index_1 = __importDefault(require("../../../index"));
const mime = __importStar(require("mime-types"));
const uniqid_1 = __importDefault(require("uniqid"));
const getFileAccessForPut = ({ form }) => {
    const eal = index_1.default.s3_leaf;
    let acl = "public-read";
    let filename = `${(0, uniqid_1.default)()}-${(0, uniqid_1.default)()}-${(0, uniqid_1.default)()}-${(0, uniqid_1.default)()}`;
    let extension = mime.extension(form.content_type);
    let path = `${form.folder}/${filename}.${extension}`;
    if (form.private && form.private === true) {
        acl = "private";
    }
    const url = eal.s3.getSignedUrl("putObject", {
        Bucket: eal.bucket,
        Key: path,
        Expires: 60 * 15,
        ACL: acl,
        ContentType: form.content_type,
    });
    let purl = "";
    if (eal.server.includes("contabo")) {
        purl = `https://${eal.server}/${eal.tenant_id}:${eal.bucket}`;
    }
    else {
        purl = `https://${eal.server}/${eal.bucket}`;
    }
    return {
        url: url,
        filename: filename,
        extension: extension,
        path: path,
        public_url: `${purl}/${path}`,
    };
};
exports.getFileAccessForPut = getFileAccessForPut;
//# sourceMappingURL=files.js.map