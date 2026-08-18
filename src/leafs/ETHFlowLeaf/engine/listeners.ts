// Which triggers anybody is actually listening to.
//
// Model hooks run on every save in the application, most of which no automation
// cares about. Asking the database "is there a flow for this?" on each one would
// put a query in the path of every write, so the answer is cached and refreshed
// by the ticker.
//
// The cache is only ever allowed to be wrong in the safe direction: a trigger it
// wrongly believes is listened to costs one useless query inside `fire()`, and
// the cache is invalidated the moment a flow is saved.

import { Flow } from '../models/Flow.js'

let listening: Set<string> = new Set()
let loaded = false

export async function refreshListeners(): Promise<void> {
    try {
        const flows = await Flow.findAll({
            where: { enabled: true, deleted_at: null as any },
            attributes: ['trigger_id'],
        })
        listening = new Set(flows.map((flow) => flow.trigger_id).filter(Boolean))
        loaded = true
    } catch (error) {
        console.error('[ETHFlowLeaf] Could not refresh the trigger cache:', error)
    }
}

/** Called whenever a flow is created, changed or removed. */
export function invalidateListeners(): void {
    loaded = false
}

/**
 * Before the first refresh every trigger is assumed live: a flow that misses its
 * first event because the cache was empty at boot is a bug nobody can reproduce.
 */
export function hasListener(triggerId: string): boolean {
    if (!loaded) return true
    return listening.has(triggerId)
}

/** True when any of a collection's three lifecycle triggers is in use. */
export function collectionHasListener(collection: string): boolean {
    if (!loaded) return true
    return (
        listening.has(`model.${collection}.created`) ||
        listening.has(`model.${collection}.updated`) ||
        listening.has(`model.${collection}.deleted`)
    )
}

export async function ensureListeners(): Promise<void> {
    if (!loaded) await refreshListeners()
}
