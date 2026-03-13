import * as path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export default class EthUserLeaf {
    constructor(config) {
        this.config = config;
        this.etherial_module_name = 'eth_user_leaf';
        this.routes = [];
        this.default_avatar = config.default_avatar;
        this.avatar_s3_folder = config.avatar_s3_folder;
        if (this.config.routes) {
            if (this.config.routes.auth && this.config.routes.auth.length > 0) {
                this.routes.push({ route: path.join(__dirname, 'routes/auth.js'), methods: this.config.routes.auth });
            }
            if (this.config.routes.users && this.config.routes.users.length > 0) {
                this.routes.push({ route: path.join(__dirname, 'routes/users.js'), methods: this.config.routes.users });
            }
            if (this.config.routes.users_email && this.config.routes.users_email.length > 0) {
                this.routes.push({ route: path.join(__dirname, 'routes/users_email.js'), methods: this.config.routes.users_email });
            }
            if (this.config.routes.users_password && this.config.routes.users_password.length > 0) {
                this.routes.push({ route: path.join(__dirname, 'routes/users_password.js'), methods: this.config.routes.users_password });
            }
            if (this.config.routes.users_phone && this.config.routes.users_phone.length > 0) {
                this.routes.push({ route: path.join(__dirname, 'routes/users_phone.js'), methods: this.config.routes.users_phone });
            }
            if (this.config.routes.auth_google && this.config.routes.auth_google.length > 0) {
                this.routes.push({ route: path.join(__dirname, 'routes/auth_google.js'), methods: this.config.routes.auth_google });
            }
            if (this.config.routes.auth_apple && this.config.routes.auth_apple.length > 0) {
                this.routes.push({ route: path.join(__dirname, 'routes/auth_apple.js'), methods: this.config.routes.auth_apple });
            }
        }
    }
    run({ http }) {
        http.routes_leafs.push(...this.routes);
    }
    commands() {
        return [];
    }
}
export const AvailableRouteMethods = {
    auth: ['authEmail'],
    auth_google: ['authGoogle'],
    auth_apple: ['authApple'],
    users: ['updateUserMeBio', 'updateUserMeAvatar'],
    users_email: ['sendEmailValidation', 'confirmEmailValidation'],
    users_password: ['userUpdatePassword', 'setUserPassword', 'requestPasswordReset', 'confirmPasswordReset'],
    users_phone: ['sendPhoneValidation', 'confirmPhoneValidation'],
};
