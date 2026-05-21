import { Request, Response } from 'etherial/components/http/provider';
import { AuthFormAppleType } from '../forms/auth_form.js';
export default class ETHUserLeafAuthAppleController {
    /**
     * Apple Sign-In.
     *
     * The identity token from Apple is REQUIRED to be cryptographically verified
     * against Apple's JWKS — signature, issuer, audience and expiration are all
     * enforced. Email is treated as a hint, never as proof of identity: account
     * linking is done strictly on the verified `sub` claim. An attacker who can
     * forge a JWT with the right email therefore cannot take over another user.
     *
     * @route POST /auth/apple
     */
    authApple(req: Request & {
        form: AuthFormAppleType;
    }, res: Response): Promise<any>;
}
