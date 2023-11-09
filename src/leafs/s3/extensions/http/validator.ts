import etherial from "../../../../index"

import { GetObjectCommand } from "@aws-sdk/client-s3";

export const ShouldBeS3File = (folder: string) : PropertyDecorator => {

    return (target: any, propertyKey: string) => {

        let validations = Reflect.getMetadata('validations', target.constructor)

        validations[propertyKey] = validations[propertyKey].custom((value) => {
            
            return new Promise((resolve, reject) => {

                const eal = etherial.s3_leaf

                eal.s3.send(new GetObjectCommand({
                    Bucket: eal.bucket,
                    Key: folder + '/' + value
                })).then(() => {
                    resolve(true)
                }).catch(() => {
                    reject('api.form.errors.file_not_exist')
                })
    
            })

        })

        Reflect.defineMetadata('validations', validations, target.constructor);

    }

}