// ──────────────────────────────────────────────────────────────────────────
// Reading and writing records.
//
// These steps work against the admin collections, which means a project gets
// them for every model it exposes without registering anything. It also means
// they respect nothing: a flow that can update a collection can update any row
// in it. That is deliberate — an automation runs as the workspace, not as a
// user — and it is why the flow routes themselves sit behind the admin access
// checker.
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
import { listCollections, getModel, getCollection, collectionLabelPlural, collectionOutputFields, hydrateRecord, humanize, } from '../registry/admin.js';
import { toWhere, filterableFields, OPERATOR_OPTIONS } from '../engine/filters.js';
function collectionField(label = 'In') {
    return {
        name: 'collection',
        type: 'select',
        label,
        required: true,
        options: listCollections().map((collection) => ({
            value: collection.name,
            label: collectionLabelPlural(collection),
        })),
    };
}
function filtersField(collectionName, label = 'Where') {
    return {
        name: 'filters',
        type: 'json',
        widget: 'flow-filters',
        label,
        defaultValue: [],
        options: [
            ...filterableFields(collectionName !== null && collectionName !== void 0 ? collectionName : '').map((field) => ({
                value: `field:${field.value}`,
                label: field.label,
            })),
            ...OPERATOR_OPTIONS.map((operator) => ({
                value: `operator:${operator.value}`,
                label: operator.label,
            })),
        ],
        showIf: { field: 'collection', operator: 'truthy' },
    };
}
/**
 * The values a create or update step writes.
 *
 * A list of field/value pairs rather than the collection's real form: every
 * value here may be a template, and a date input cannot hold
 * `{{record.starts_at}}`.
 */
function valuesField(collectionName) {
    var _a;
    const collection = collectionName ? getCollection(collectionName) : null;
    return {
        name: 'values',
        type: 'json',
        widget: 'flow-values',
        label: 'Set',
        defaultValue: [],
        options: ((_a = collection === null || collection === void 0 ? void 0 : collection.fields) !== null && _a !== void 0 ? _a : [])
            .filter((field) => !field.readonly && field.type !== 'hasMany' && field.type !== 'belongsToMany')
            .map((field) => ({ value: field.name, label: field.label || humanize(field.name) })),
        showIf: { field: 'collection', operator: 'truthy' },
    };
}
function orderFields(collectionName) {
    return [
        {
            name: 'order_by',
            type: 'select',
            label: 'Sorted by',
            defaultValue: 'created_at',
            options: filterableFields(collectionName !== null && collectionName !== void 0 ? collectionName : ''),
            showIf: { field: 'collection', operator: 'truthy' },
        },
        {
            name: 'order_dir',
            type: 'select',
            label: 'Direction',
            defaultValue: 'DESC',
            options: [
                { value: 'ASC', label: 'Oldest / smallest first' },
                { value: 'DESC', label: 'Newest / largest first' },
            ],
        },
    ];
}
/** Turns the `[{field, value}]` widget rows into an object. */
function toValues(rows) {
    if (!Array.isArray(rows))
        return rows && typeof rows === 'object' ? rows : {};
    const values = {};
    for (const row of rows) {
        if (!(row === null || row === void 0 ? void 0 : row.field))
            continue;
        values[row.field] = row.value;
    }
    return values;
}
function requireModel(collectionName) {
    const model = getModel(collectionName);
    if (!model)
        throw new Error(`Unknown collection "${collectionName}"`);
    return model;
}
export const findNode = {
    id: 'data.find',
    label: 'Find records',
    description: 'Looks up a list of records. Feed it to a For each.',
    icon: 'Search',
    category: 'data',
    config: (config) => [
        collectionField(),
        filtersField(config === null || config === void 0 ? void 0 : config.collection),
        ...orderFields(config === null || config === void 0 ? void 0 : config.collection),
        { name: 'limit', type: 'number', label: 'At most', defaultValue: 50, min: 1, max: 500 },
    ],
    output: (config) => [
        {
            key: 'records',
            label: 'Records',
            type: 'array',
            collection: config === null || config === void 0 ? void 0 : config.collection,
            fields: (config === null || config === void 0 ? void 0 : config.collection) ? collectionOutputFields(config.collection) : undefined,
        },
        { key: 'count', label: 'How many', type: 'number' },
        { key: 'found', label: 'Found any', type: 'boolean' },
    ],
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, log }) {
        const model = requireModel(config.collection);
        const limit = Math.min(500, Math.max(1, Number(config.limit) || 50));
        const rows = yield model.findAll({
            where: toWhere(config.filters, 'all'),
            order: [[config.order_by || 'created_at', config.order_dir === 'ASC' ? 'ASC' : 'DESC']],
            limit,
        });
        const records = yield Promise.all(rows.map((row) => hydrateRecord(config.collection, row)));
        log(`${records.length} record${records.length === 1 ? '' : 's'}`);
        return { output: { records, count: records.length, found: records.length > 0 } };
    }),
};
export const findOneNode = {
    id: 'data.find_one',
    label: 'Find one record',
    description: 'Looks up a single record and branches on whether it exists.',
    icon: 'FileSearch',
    category: 'data',
    config: (config) => [
        collectionField(),
        filtersField(config === null || config === void 0 ? void 0 : config.collection),
        ...orderFields(config === null || config === void 0 ? void 0 : config.collection),
    ],
    branches: [
        { id: 'found', label: 'Found' },
        { id: 'missing', label: 'Not found' },
    ],
    output: (config) => [
        {
            key: 'record',
            label: 'Record',
            type: 'object',
            collection: config === null || config === void 0 ? void 0 : config.collection,
            fields: (config === null || config === void 0 ? void 0 : config.collection) ? collectionOutputFields(config.collection) : undefined,
        },
        { key: 'found', label: 'Found', type: 'boolean' },
    ],
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, log }) {
        const model = requireModel(config.collection);
        const row = yield model.findOne({
            where: toWhere(config.filters, 'all'),
            order: [[config.order_by || 'created_at', config.order_dir === 'ASC' ? 'ASC' : 'DESC']],
        });
        if (!row) {
            log('No record matched');
            return { branch: 'missing', output: { record: null, found: false } };
        }
        const record = yield hydrateRecord(config.collection, row);
        log(`Found #${record.id}`);
        return { branch: 'found', output: { record, found: true } };
    }),
};
export const createNode = {
    id: 'data.create',
    label: 'Create a record',
    description: 'Adds a row.',
    icon: 'FilePlus',
    category: 'data',
    config: (config) => [collectionField(), valuesField(config === null || config === void 0 ? void 0 : config.collection)],
    output: (config) => [
        {
            key: 'record',
            label: 'Created record',
            type: 'object',
            collection: config === null || config === void 0 ? void 0 : config.collection,
            fields: (config === null || config === void 0 ? void 0 : config.collection) ? collectionOutputFields(config.collection) : undefined,
        },
    ],
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, log }) {
        const model = requireModel(config.collection);
        const values = toValues(config.values);
        const created = yield model.create(values);
        const record = yield hydrateRecord(config.collection, created);
        log(`Created #${record.id}`);
        return { output: { record } };
    }),
};
export const updateNode = {
    id: 'data.update',
    label: 'Update records',
    description: 'Changes the record that triggered the automation, or every record matching a condition.',
    icon: 'FilePen',
    category: 'data',
    config: (config) => [
        collectionField(),
        {
            name: 'target',
            type: 'select',
            label: 'Which',
            defaultValue: 'id',
            options: [
                { value: 'id', label: 'One record, by ID' },
                { value: 'filters', label: 'Every record matching a condition' },
            ],
        },
        {
            name: 'record_id',
            type: 'string',
            label: 'Record',
            defaultValue: '{{record.id}}',
            showIf: { field: 'target', operator: 'eq', value: 'id' },
        },
        Object.assign(Object.assign({}, filtersField(config === null || config === void 0 ? void 0 : config.collection)), { showIf: { field: 'target', operator: 'eq', value: 'filters' } }),
        valuesField(config === null || config === void 0 ? void 0 : config.collection),
        {
            name: 'limit',
            type: 'number',
            label: 'At most',
            defaultValue: 100,
            min: 1,
            max: 1000,
            showIf: { field: 'target', operator: 'eq', value: 'filters' },
        },
    ],
    output: [{ key: 'updated', label: 'Rows updated', type: 'number' }],
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, log }) {
        const model = requireModel(config.collection);
        const values = toValues(config.values);
        if (Object.keys(values).length === 0) {
            log('Nothing to set');
            return { output: { updated: 0 } };
        }
        if (config.target === 'filters') {
            const rows = yield model.findAll({
                where: toWhere(config.filters, 'all'),
                limit: Math.min(1000, Math.max(1, Number(config.limit) || 100)),
            });
            // Row by row rather than one UPDATE: the model hooks have to fire, or
            // an automation that changes a status would not trigger the
            // automation that watches that status.
            for (const row of rows)
                yield row.update(values);
            log(`${rows.length} record${rows.length === 1 ? '' : 's'} updated`);
            return { output: { updated: rows.length } };
        }
        const row = yield model.findByPk(config.record_id);
        if (!row) {
            log(`No record #${config.record_id}`);
            return { output: { updated: 0 } };
        }
        yield row.update(values);
        log(`Updated #${config.record_id}`);
        return { output: { updated: 1, record: yield hydrateRecord(config.collection, row) } };
    }),
};
export const deleteNode = {
    id: 'data.delete',
    label: 'Delete a record',
    description: 'Removes a row.',
    icon: 'Trash2',
    category: 'data',
    config: () => [
        collectionField(),
        {
            name: 'record_id',
            type: 'string',
            label: 'Record',
            defaultValue: '{{record.id}}',
            required: true,
        },
    ],
    output: [{ key: 'deleted', label: 'Deleted', type: 'boolean' }],
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, log }) {
        const model = requireModel(config.collection);
        const row = yield model.findByPk(config.record_id);
        if (!row) {
            log(`No record #${config.record_id}`);
            return { output: { deleted: false } };
        }
        yield row.destroy();
        log(`Deleted #${config.record_id}`);
        return { output: { deleted: true } };
    }),
};
export const countNode = {
    id: 'data.count',
    label: 'Count records',
    description: 'How many rows match — for thresholds and digests.',
    icon: 'Hash',
    category: 'data',
    config: (config) => [collectionField(), filtersField(config === null || config === void 0 ? void 0 : config.collection)],
    output: [{ key: 'count', label: 'Count', type: 'number' }],
    execute: (_a) => __awaiter(void 0, [_a], void 0, function* ({ config, log }) {
        const model = requireModel(config.collection);
        const count = yield model.count({ where: toWhere(config.filters, 'all') });
        log(`${count}`);
        return { output: { count } };
    }),
};
export function registerDataNodes() {
    registry.registerNode(findNode);
    registry.registerNode(findOneNode);
    registry.registerNode(createNode);
    registry.registerNode(updateNode);
    registry.registerNode(deleteNode);
    registry.registerNode(countNode);
}
