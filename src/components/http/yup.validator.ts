import * as yup from 'yup'

import { Middleware } from './provider'

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
                this.parent._modelInstances = this.parent._modelInstances || {}
                this.parent._modelInstances[this.path] = existingRecord
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
                this.parent._modelInstances = this.parent._modelInstances || {}
                this.parent._modelInstances[this.path] = existingRecord
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

    return Middleware(async (req, res, next) => {
        try {
            const validatedData = await schema.validate(req[location], { abortEarly: false, strict: true, stripUnknown: true })
            req.form = { ...req.form, ...validatedData }
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
