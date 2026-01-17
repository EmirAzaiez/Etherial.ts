import etherial from 'etherial'
import { Router, Request, Response } from 'express'
import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    ShouldFindAllFromModel,
    ShouldFindOneFromModel,
    ShouldCreateFromModel,
    ShouldUpdateFromModel,
    ShouldDeleteFromModel
} from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'
import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator'

const getAdminLeaf = () => (etherial as any).eth_admin_leaf

/**
 * Generate CRUD controller class for a collection
 */
function createCollectionController(collection: any) {
    const { name, model, crud, attributes, allowedFilters, search, include, defaultOrder, createForm, updateForm } = collection

    @Controller()
    class DynamicCollectionController {
        // LIST
        @Get(`/admin/collections/${name}`)
        @ShouldBeAuthenticated()
        @ShouldFindAllFromModel(model, {
            attributes,
            allowedFilters: allowedFilters || [],
            search,
            include: include || [],
            defaultOrder: defaultOrder || [['created_at', 'DESC']],
            canAccess: async (req: any) => {
                return getAdminLeaf()?.checkAccess(req.user, name, 'list') ?? false
            }
        })
        list() { }

        // SHOW
        @Get(`/admin/collections/${name}/:id`)
        @ShouldBeAuthenticated()
        @ShouldFindOneFromModel(model, {
            paramName: 'id',
            attributes,
            include: include || [],
            canAccess: async (req: any) => {
                return getAdminLeaf()?.checkAccess(req.user, name, 'show') ?? false
            }
        })
        show() { }

        // CREATE (with form validation)
        @Post(`/admin/collections/${name}`)
        @ShouldBeAuthenticated()
        async create(req: Request & { form: any; user: any }, res: Response): Promise<any> {
            const hasAccess = await getAdminLeaf()?.checkAccess(req.user, name, 'create')
            if (!hasAccess) {
                return (res as any).error?.({ status: 403, errors: ['forbidden'] })
            }

            // Use req.form if available (after validation), fallback to req.body
            const data = req.form || req.body

            try {
                const record = await model.create(data)
                return (res as any).success?.({ status: 201, data: record })
            } catch (err: any) {
                return (res as any).error?.({ status: 400, errors: err.errors || [err.message] })
            }
        }

        // UPDATE (with form validation)
        @Put(`/admin/collections/${name}/:id`)
        @ShouldBeAuthenticated()
        async update(req: Request & { form: any; user: any }, res: Response): Promise<any> {
            const hasAccess = await getAdminLeaf()?.checkAccess(req.user, name, 'update')
            if (!hasAccess) {
                return (res as any).error?.({ status: 403, errors: ['forbidden'] })
            }

            const data = req.form || req.body

            try {
                const record = await model.findByPk(req.params.id)
                if (!record) {
                    return (res as any).error?.({ status: 404, errors: ['not_found'] })
                }
                await record.update(data)
                return (res as any).success?.({ status: 200, data: record })
            } catch (err: any) {
                return (res as any).error?.({ status: 400, errors: err.errors || [err.message] })
            }
        }

        // DELETE
        @Delete(`/admin/collections/${name}/:id`)
        @ShouldBeAuthenticated()
        @ShouldDeleteFromModel(model, {
            paramName: 'id',
            canAccess: async (req: any) => {
                return getAdminLeaf()?.checkAccess(req.user, name, 'delete') ?? false
            }
        })
        delete() { }
    }

    // Apply form validation decorators dynamically if forms are provided
    if (createForm && crud.includes('create')) {
        const createDescriptor = Object.getOwnPropertyDescriptor(DynamicCollectionController.prototype, 'create')
        if (createDescriptor) {
            ShouldValidateYupForm(createForm)(DynamicCollectionController.prototype, 'create', createDescriptor)
        }
    }

    if (updateForm && crud.includes('update')) {
        const updateDescriptor = Object.getOwnPropertyDescriptor(DynamicCollectionController.prototype, 'update')
        if (updateDescriptor) {
            ShouldValidateYupForm(updateForm)(DynamicCollectionController.prototype, 'update', updateDescriptor)
        }
    }

    return DynamicCollectionController
}

/**
 * Register all collection controllers
 */
export function registerCollections() {
    const adminLeaf = getAdminLeaf()
    const collections = adminLeaf?.collections || []
    const controllers: any[] = []

    for (const collection of collections) {
        // Only register methods that are in crud array
        if (collection.crud && collection.crud.length > 0) {
            const ControllerClass = createCollectionController(collection)
            controllers.push(ControllerClass)
        }
    }

    return controllers
}

export default Router()
export const AvailableRouteMethods = ['crud'] as const
