import { Etherial } from 'etherial'
import * as path from 'path'

export type AccessChecker = (
    user: any,
    context: { route: string; method: string }
) => Promise<boolean> | boolean

export interface SearchConfig {
    paramName?: string
    fields: string[]
}

export interface Collection {
    name: string
    model: any
    crud: ('list' | 'show' | 'create' | 'update' | 'delete')[]
    attributes?: string[]
    allowedFilters?: string[]
    search?: SearchConfig
    include?: any[]
    defaultOrder?: [string, string][]
    createForm?: any
    updateForm?: any
}

export interface FeatureConfig {
    enabled: boolean
    attributes?: string[]
    search?: SearchConfig
    allowedFilters?: string[]
}

export interface ETHAdminLeafConfig {
    prefix?: string
    users?: FeatureConfig
    messages?: FeatureConfig
    campaigns?: FeatureConfig
    collections?: Collection[]
}

export default class ETHAdminLeaf {
    readonly etherial_module_name = 'eth_admin_leaf'

    private _accessChecker?: AccessChecker
    private _config: ETHAdminLeafConfig
    private _collections: Collection[] = []
    private routes: { route: string; methods: string[] }[] = []

    constructor(config: ETHAdminLeafConfig = {}) {
        this._config = { prefix: '/admin', ...config }
        this._collections = config.collections || []

        if (config.users?.enabled) {
            this.routes.push({
                route: path.join(__dirname, 'routes/users'),
                methods: ['list']
            })
        }

        if (config.messages?.enabled) {
            this.routes.push({
                route: path.join(__dirname, 'routes/message_logs'),
                methods: ['list', 'show']
            })
        }

        if (config.campaigns?.enabled) {
            this.routes.push({
                route: path.join(__dirname, 'routes/notification_campaigns'),
                methods: ['list', 'show', 'create']
            })
        }

        if (config.collections && config.collections.length > 0) {
            this.routes.push({
                route: path.join(__dirname, 'routes/collections'),
                methods: ['crud']
            })
        }
    }

    setAccessChecker(checker: AccessChecker): void {
        this._accessChecker = checker
    }

    get accessChecker(): AccessChecker | undefined {
        return this._accessChecker
    }

    get config(): ETHAdminLeafConfig {
        return this._config
    }

    get collections(): Collection[] {
        return this._collections
    }

    getCollection(name: string): Collection | undefined {
        return this._collections.find(c => c.name === name)
    }

    async checkAccess(user: any, route: string, method: string): Promise<boolean> {
        if (!this._accessChecker) {
            console.warn('[ETHAdminLeaf] No access checker set.')
            return false
        }
        return this._accessChecker(user, { route, method })
    }

    run({ http }: Etherial) {
        http?.routes_leafs?.push(...this.routes)
    }

    commands() {
        return []
    }
}
