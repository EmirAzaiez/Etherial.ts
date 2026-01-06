import { Etherial } from 'etherial'

import * as path from 'path'

export default class EthUserLeaf {
    etherial_module_name = 'eth_user_leaf'

    private routes: { route: string; methods: string[] }[] = []
    default_avatar: string

    constructor(private config: ETHUserLeafConfig) {
        this.default_avatar = config.default_avatar

        if (this.config.routes) {
            if (this.config.routes.auth && this.config.routes.auth.length > 0) {
                this.routes.push({ route: path.join(__dirname, 'routes/auth'), methods: this.config.routes.auth })
            }

            if (this.config.routes.users && this.config.routes.users.length > 0) {
                this.routes.push({ route: path.join(__dirname, 'routes/users'), methods: this.config.routes.users })
            }

            if (this.config.routes.users_password && this.config.routes.users_password.length > 0) {
                this.routes.push({ route: path.join(__dirname, 'routes/users_password'), methods: this.config.routes.users_password })
            }

            if (this.config.routes.users_phone && this.config.routes.users_phone.length > 0) {
                this.routes.push({ route: path.join(__dirname, 'routes/users_phone'), methods: this.config.routes.users_phone })
            }

            if (this.config.routes.auth_google && this.config.routes.auth_google.length > 0) {
                this.routes.push({ route: path.join(__dirname, 'routes/auth_google'), methods: this.config.routes.auth_google })
            }

            if (this.config.routes.auth_apple && this.config.routes.auth_apple.length > 0) {
                this.routes.push({ route: path.join(__dirname, 'routes/auth_apple'), methods: this.config.routes.auth_apple })
            }
        }
    }

    run({ http }: Etherial) {
        http?.routes_leafs?.push(...this.routes)
    }

    commands() {
        return []
    }
}

export const AvailableRouteMethods = {
    auth: ['authEmail'],
    auth_google: ['authGoogle'],
    auth_apple: ['authApple'],
    users: ['updateUserMeBio', 'updateUserMeAvatar'],
    users_password: ['userUpdatePassword', 'setUserPassword', 'requestPasswordReset', 'confirmPasswordReset'],
    users_phone: ['sendPhoneValidation', 'confirmPhoneValidation'],
} as const

export type AuthMethods = (typeof AvailableRouteMethods.auth)[number]
export type AuthGoogleMethods = (typeof AvailableRouteMethods.auth_google)[number]
export type AuthAppleMethods = (typeof AvailableRouteMethods.auth_apple)[number]
export type UsersMethods = (typeof AvailableRouteMethods.users)[number]
export type UsersPasswordMethods = (typeof AvailableRouteMethods.users_password)[number]
export type UsersPhoneMethods = (typeof AvailableRouteMethods.users_phone)[number]

export interface ETHUserLeafConfig {
    default_avatar: string
    routes: {
        auth: AuthMethods[]
        auth_google: AuthGoogleMethods[]
        auth_apple: AuthAppleMethods[]
        users: UsersMethods[]
        users_password: UsersPasswordMethods[]
        users_phone: UsersPhoneMethods[]
    }
}
