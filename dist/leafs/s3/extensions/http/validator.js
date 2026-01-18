import etherial from "../../../../index.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
export const ShouldBeS3File = (folder) => {
    return (target, propertyKey) => {
        let validations = Reflect.getMetadata('validations', target.constructor);
        validations[propertyKey] = validations[propertyKey].custom((value) => {
            return new Promise((resolve, reject) => {
                const eal = etherial.leaf_s3;
                eal.s3.send(new GetObjectCommand({
                    Bucket: eal.bucket,
                    Key: folder + '/' + value
                })).then(() => {
                    resolve(true);
                }).catch(() => {
                    reject('api.form.errors.file_not_exist');
                });
            });
        });
        Reflect.defineMetadata('validations', validations, target.constructor);
    };
};
