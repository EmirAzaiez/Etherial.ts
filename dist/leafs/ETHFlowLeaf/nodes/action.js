// ──────────────────────────────────────────────────────────────────────────
// Running an admin action from a flow.
//
// Every button the back-office shows on a record — approve, resend, cancel,
// sync — is an entry in the admin's ActionRegistry, with a label, a form and a
// handler that has already been reviewed and shipped. This step makes all of
// them available to automations without registering a single thing: the
// customer picks the action, and its own form appears underneath.
//
// It is the answer to "toutes les actions sont créables via ce qu'on a" — adding
// an action to the admin adds it to the automation builder in the same commit.
// ──────────────────────────────────────────────────────────────────────────
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { registry } from '../registry/Registry.js';
import { adminLeaf, getCollection, getModel, listCollections, collectionLabelPlural } from '../registry/admin.js';
function actionsOf(collectionName) {
    var _a;
    const collection = collectionName ? getCollection(collectionName) : null;
    const leaf = adminLeaf();
    if (!collection || !leaf)
        return [];
    return ((_a = collection.actions) !== null && _a !== void 0 ? _a : []).map((name) => {
        var _a, _b, _c;
        const action = (_b = (_a = leaf.actions) === null || _a === void 0 ? void 0 : _a.get) === null || _b === void 0 ? void 0 : _b.call(_a, name);
        return { value: name, label: ((_c = action === null || action === void 0 ? void 0 : action.meta) === null || _c === void 0 ? void 0 : _c.label) || name };
    });
}
/**
 * The chosen action's own form, prefixed so it cannot collide with this step's
 * own configuration — an action with a field called `collection` would otherwise
 * quietly overwrite the collection picker.
 */
function actionForm(collectionName, actionName) {
    var _a, _b;
    const leaf = adminLeaf();
    if (!leaf || !collectionName || !actionName)
        return [];
    const serialized = (_b = (_a = leaf.actions) === null || _a === void 0 ? void 0 : _a.serialize) === null || _b === void 0 ? void 0 : _b.call(_a, actionName);
    if (!(serialized === null || serialized === void 0 ? void 0 : serialized.form))
        return [];
    return serialized.form.map((field) => (Object.assign(Object.assign({}, field), { name: `input_${field.name}`, 
        // Every value here may be a template, and the run supplies it, so the
        // admin's own "required" would only block saving a valid flow.
        required: false })));
}
export const runActionNode = {
    id: 'action.run',
    label: 'Run an action',
    description: 'Runs one of the buttons the back-office already offers on a record.',
    icon: 'Zap',
    category: 'action',
    available: () => adminLeaf() !== null,
    config: (config) => [
        {
            name: 'collection',
            type: 'select',
            label: 'On',
            required: true,
            options: listCollections()
                .filter((collection) => { var _a; return ((_a = collection.actions) !== null && _a !== void 0 ? _a : []).length > 0; })
                .map((collection) => ({
                value: collection.name,
                label: collectionLabelPlural(collection),
            })),
        },
        {
            name: 'action',
            type: 'select',
            label: 'Action',
            required: true,
            options: actionsOf(config === null || config === void 0 ? void 0 : config.collection),
            showIf: { field: 'collection', operator: 'truthy' },
        },
        {
            name: 'record_id',
            type: 'string',
            label: 'Record',
            defaultValue: '{{record.id}}',
            showIf: { field: 'action', operator: 'truthy' },
        },
        ...actionForm(config === null || config === void 0 ? void 0 : config.collection, config === null || config === void 0 ? void 0 : config.action),
    ],
    branches: [
        { id: 'ok', label: 'Succeeded' },
        { id: 'error', label: 'Failed' },
    ],
    output: [
        { key: 'success', label: 'Succeeded', type: 'boolean' },
        { key: 'data', label: 'Result', type: 'object' },
        { key: 'error', label: 'Error', type: 'string' },
    ],
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, context, log }) {
        var _b, _c, _d, _e, _f, _g, _h;
        const leaf = adminLeaf();
        if (!leaf)
            throw new Error('The admin panel is not installed in this project.');
        const collectionName = String((_b = config.collection) !== null && _b !== void 0 ? _b : '');
        const actionName = String((_c = config.action) !== null && _c !== void 0 ? _c : '');
        const collection = getCollection(collectionName);
        const model = getModel(collectionName);
        if (!collection || !model)
            throw new Error(`Unknown collection "${collectionName}"`);
        if (!((_e = (_d = leaf.actions) === null || _d === void 0 ? void 0 : _d.has) === null || _e === void 0 ? void 0 : _e.call(_d, actionName)))
            throw new Error(`Unknown action "${actionName}"`);
        const record = config.record_id ? yield model.findByPk(config.record_id) : null;
        if (config.record_id && !record) {
            log(`No record #${config.record_id}`);
            return { branch: 'error', output: { success: false, error: 'Record not found' } };
        }
        const input = {};
        for (const [key, value] of Object.entries(config)) {
            if (key.startsWith('input_'))
                input[key.slice(6)] = value;
        }
        // Actions are written against an Express request. There is none here, so
        // they get one that carries the truth: the automation ran it, on behalf
        // of whoever the run belongs to.
        const request = {
            user: null,
            body: input,
            params: {},
            query: {},
            headers: {},
            flow: { id: context.flowId, name: context.flowName, runId: context.runId },
        };
        const result = yield leaf.actions.execute(actionName, record, input, request, {
            collection,
            model,
        });
        if (result === null || result === void 0 ? void 0 : result.success) {
            log(`${actionName} ran`);
            return { branch: 'ok', output: { success: true, data: (_f = result.data) !== null && _f !== void 0 ? _f : null } };
        }
        log(`${actionName} failed: ${(_g = result === null || result === void 0 ? void 0 : result.error) !== null && _g !== void 0 ? _g : 'unknown error'}`);
        return { branch: 'error', output: { success: false, error: (_h = result === null || result === void 0 ? void 0 : result.error) !== null && _h !== void 0 ? _h : 'Unknown error' } };
    }),
};
export function registerActionNodes() {
    registry.registerNode(runActionNode);
}
