import etherial from '../../index'
import { Middleware } from '../http/provider'

export const ShouldBeAuthentificate = () : MethodDecorator => {
    return Middleware(etherial['http_security'].authentificatorMiddleware)
}

export const ShouldHaveRole = (role) : MethodDecorator => {
    return Middleware(etherial['http_security'].authentificatorRoleCheckerMiddleware(role))
} 