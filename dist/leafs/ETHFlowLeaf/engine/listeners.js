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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Flow } from '../models/Flow.js';
let listening = new Set();
let loaded = false;
export function refreshListeners() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const flows = yield Flow.findAll({
                where: { enabled: true, deleted_at: null },
                attributes: ['trigger_id'],
            });
            listening = new Set(flows.map((flow) => flow.trigger_id).filter(Boolean));
            loaded = true;
        }
        catch (error) {
            console.error('[ETHFlowLeaf] Could not refresh the trigger cache:', error);
        }
    });
}
/** Called whenever a flow is created, changed or removed. */
export function invalidateListeners() {
    loaded = false;
}
/**
 * Before the first refresh every trigger is assumed live: a flow that misses its
 * first event because the cache was empty at boot is a bug nobody can reproduce.
 */
export function hasListener(triggerId) {
    if (!loaded)
        return true;
    return listening.has(triggerId);
}
/** True when any of a collection's three lifecycle triggers is in use. */
export function collectionHasListener(collection) {
    if (!loaded)
        return true;
    return (listening.has(`model.${collection}.created`) ||
        listening.has(`model.${collection}.updated`) ||
        listening.has(`model.${collection}.deleted`));
}
export function ensureListeners() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!loaded)
            yield refreshListeners();
    });
}
