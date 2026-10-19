import etherial from 'etherial'

import { REQUESTS_COLLECTION } from './options.js'
import { state } from './state.js'

/** Whoever may list what was asked may ask, unless the project says otherwise. */
export async function mayUse(user: any): Promise<boolean> {
    const adminLeaf = (etherial as any).eth_admin_leaf
    if (!adminLeaf || !(await adminLeaf.canAccessAdmin(user))) return false
    if (state.config.canUse) return !!(await state.config.canUse(user))
    return !!(await adminLeaf.checkAccess(user, REQUESTS_COLLECTION, 'list'))
}
