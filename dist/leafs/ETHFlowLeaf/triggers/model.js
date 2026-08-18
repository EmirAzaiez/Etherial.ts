// ──────────────────────────────────────────────────────────────────────────
// "This model was created / updated / deleted."
//
// The customer asked for exactly this: *tel model a été créé, tel model a été
// ajouté*. Rather than a list of hand-written events that someone has to extend
// every time a model appears, the leaf hooks the Sequelize models the admin
// panel already exposes. Register a collection in the back-office and its three
// lifecycle triggers exist, with the right field names in the picker.
//
// Two things are deliberate here. Hooks are attached once and never fire the
// flow synchronously — saving a record must not get slower, and must not fail,
// because an automation attached to it did. And bulk writes only pay for
// per-row hooks when a flow is actually listening.
// ──────────────────────────────────────────────────────────────────────────
import { leafConfig } from '../config.js';
import { fireAndForget } from '../engine/fire.js';
import { collectionHasListener, hasListener } from '../engine/listeners.js';
import { listCollections } from '../registry/admin.js';
const HOOKED = Symbol.for('eth_flow_leaf.hooked');
const PREVIOUS = Symbol.for('eth_flow_leaf.previous');
export function installModelHooks() {
    if (leafConfig().modelTriggers === false)
        return 0;
    let hooked = 0;
    for (const collection of listCollections()) {
        const model = collection.model;
        if (!model || typeof model.addHook !== 'function')
            continue;
        if (model[HOOKED])
            continue;
        model[HOOKED] = true;
        const name = collection.name;
        model.addHook('afterCreate', 'eth_flow_created', (instance) => {
            if (!hasListener(`model.${name}.created`))
                return;
            fireAndForget({ triggerId: `model.${name}.created`, record: instance });
        });
        // The previous values have to be taken before the save commits them;
        // afterwards the instance no longer remembers what it used to be.
        model.addHook('beforeUpdate', 'eth_flow_snapshot', (instance) => {
            if (!hasListener(`model.${name}.updated`))
                return;
            try {
                instance[PREVIOUS] = Object.assign({}, instance.previous());
            }
            catch (_a) {
                instance[PREVIOUS] = {};
            }
        });
        model.addHook('afterUpdate', 'eth_flow_updated', (instance, options) => {
            var _a, _b, _c;
            if (!hasListener(`model.${name}.updated`))
                return;
            const changed = (_b = (_a = options === null || options === void 0 ? void 0 : options.fields) !== null && _a !== void 0 ? _a : instance.changed()) !== null && _b !== void 0 ? _b : [];
            fireAndForget({
                triggerId: `model.${name}.updated`,
                record: instance,
                payload: {
                    changed,
                    previous: (_c = instance[PREVIOUS]) !== null && _c !== void 0 ? _c : {},
                },
            });
        });
        model.addHook('afterDestroy', 'eth_flow_deleted', (instance) => {
            if (!hasListener(`model.${name}.deleted`))
                return;
            // The payload is the last place this record exists, which is exactly
            // what a "notify me when something is cancelled" flow needs.
            fireAndForget({ triggerId: `model.${name}.deleted`, record: instance });
        });
        // `Model.update({...}, { where })` issues one statement and skips row
        // hooks entirely. Asking for individual hooks brings them back — at the
        // cost of loading the rows, so only when someone is listening.
        model.addHook('beforeBulkUpdate', 'eth_flow_bulk_update', (options) => {
            if (options.individualHooks)
                return;
            if (!collectionHasListener(name))
                return;
            options.individualHooks = true;
        });
        model.addHook('beforeBulkDestroy', 'eth_flow_bulk_destroy', (options) => {
            if (options.individualHooks)
                return;
            if (!collectionHasListener(name))
                return;
            options.individualHooks = true;
        });
        hooked += 1;
    }
    return hooked;
}
