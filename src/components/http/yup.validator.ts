import * as yup from 'yup'

import { Middleware, Request, Response, NextFunction } from './provider'

declare module 'yup' {
    interface StringSchema {
        shouldNotExistInModel(model: any, column: string, message?: string): StringSchema
        shouldExistInModel(model: any, column: string, message?: string): StringSchema
        shouldMatchField(fieldName: string, message?: string): StringSchema
    }

    interface NumberSchema {
        shouldNotExistInModel(model: any, column: string, message?: string): NumberSchema
        shouldExistInModel(model: any, column: string, message?: string): NumberSchema
    }

    interface MixedSchema {
        shouldNotExistInModel(model: any, column: string, message?: string): MixedSchema
        shouldExistInModel(model: any, column: string, message?: string): MixedSchema
    }
}

yup.addMethod(yup.mixed, 'shouldNotExistInModel', function (model: any, column: string, message: string = 'api.form.errors.already_exist_in_database') {
    return this.test('shouldNotExistInModel', message, async function (value) {
        if (value === undefined || value === null) return true

        try {
            const existingRecord = await model.findOne({ where: { [column]: value } })
            return !existingRecord
        } catch (error) {
            return this.createError({ message: 'Database error during validation' })
        }
    })
})

const deriveInstanceKeyFromPath = (path: string): string => {
    if (!path) return '_instance'
    if (path.endsWith('_id')) return path.slice(0, -3)
    if (path.endsWith('Id')) return path.slice(0, -2)
    if (path.endsWith('ID')) return path.slice(0, -2)
    return `${path}_instance`
}

yup.addMethod(yup.number, 'shouldNotExistInModel', function (model: any, column: string, message: string = 'api.form.errors.already_exist_in_database') {
    return this.test('shouldNotExistInModel', message, async function (value) {
        if (value === undefined || value === null) return true

        try {
            const existingRecord = await model.findOne({ where: { [column]: value } })
            return !existingRecord
        } catch (error) {
            return this.createError({ message: 'Database error during validation' })
        }
    })
})

yup.addMethod(yup.number, 'shouldExistInModel', function (model: any, column: string, message: string = 'api.form.errors.not_found_in_database') {
    return this.test('shouldExistInModel', message, async function (value) {
        if (value === undefined || value === null) return true

        try {
            const existingRecord = await model.findOne({ where: { [column]: value } })
            if (existingRecord) {
                const aliasKey = deriveInstanceKeyFromPath(this.path)

                this.parent._modelInstances = this.parent._modelInstances || {}
                this.parent._modelInstances[this.path] = existingRecord
                this.parent._modelInstances[aliasKey] = existingRecord

                const ctx: any = (this as any).options?.context
                if (ctx) {
                    ctx._modelInstances = ctx._modelInstances || {}
                    ctx._modelInstances[this.path] = existingRecord
                    ctx._modelInstances[aliasKey] = existingRecord
                }
                return true
            }
            return false
        } catch (error) {
            return this.createError({ message: 'Database error during validation' })
        }
    })
})

yup.addMethod(yup.string, 'shouldNotExistInModel', function (model: any, column: string, message: string = 'api.form.errors.already_exist_in_database') {
    return this.test('shouldNotExistInModel', message, async function (value) {
        if (value === undefined || value === null) return true

        try {
            const existingRecord = await model.findOne({ where: { [column]: value } })
            return !existingRecord
        } catch (error) {
            return this.createError({ message: 'Database error during validation' })
        }
    })
})

yup.addMethod(yup.string, 'shouldExistInModel', function (model: any, column: string, message: string = 'api.form.errors.not_found_in_database') {
    return this.test('shouldExistInModel', message, async function (value) {
        if (value === undefined || value === null) return true

        try {
            const existingRecord = await model.findOne({ where: { [column]: value } })
            if (existingRecord) {
                const aliasKey = deriveInstanceKeyFromPath(this.path)

                this.parent._modelInstances = this.parent._modelInstances || {}
                this.parent._modelInstances[this.path] = existingRecord
                this.parent._modelInstances[aliasKey] = existingRecord

                const ctx: any = (this as any).options?.context
                if (ctx) {
                    ctx._modelInstances = ctx._modelInstances || {}
                    ctx._modelInstances[this.path] = existingRecord
                    ctx._modelInstances[aliasKey] = existingRecord
                }
                return true
            }
            return false
        } catch (error) {
            return this.createError({ message: 'Database error during validation' })
        }
    })
})

yup.addMethod(yup.string, 'shouldMatchField', function (fieldName: string, message: string = 'Fields do not match') {
    return this.test('shouldMatchField', message, function (value) {
        const otherValue = this.parent[fieldName]
        return value === otherValue
    })
})

yup.addMethod(yup.string, 'shouldBeStrongPassword', function (message: string = 'Password is not strong enough') {
    return this.test('shouldBeStrongPassword', message, function (value) {
        if (!value) return true

        const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
        return strongPasswordRegex.test(value)
    })
})

export const EtherialYup = yup

export const { object, string, number, boolean, date, array, mixed } = yup

export const ShouldValidateYupForm = (schema: any, location: 'body' | 'query' | 'params' = 'body') => {

    if (location != 'body' && location != 'query' && location != 'params') {
        throw new Error('ShouldValidateYupForm: Invalid location')
    }

    return Middleware(async (req: Request, res: Response, next: NextFunction) => {
        try {
            const yupContext: any = { _modelInstances: {} }
            const validatedData = await schema.validate(req[location], { abortEarly: false, strict: true, stripUnknown: true, context: yupContext })

            req.form = { ...req.form, ...validatedData }

            const instances = yupContext?._modelInstances || {}
            for (const key in instances) {
                if (!(key in validatedData)) {
                    req.form[key] = instances[key]
                }
            }
            next()
        } catch (error) {
            res.error({ status: 400, errors: error.errors })
        }
    })
}

/**
 * @deprecated The method should not be used, use instead ShouldValidateYupForm
 */
export const UseYupForm = ShouldValidateYupForm
