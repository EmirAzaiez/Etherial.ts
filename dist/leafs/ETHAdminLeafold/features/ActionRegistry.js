var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// ============================================
// Yup to Form Conversion
// ============================================
function getYupType(schema) {
    var _a, _b, _c, _d, _e;
    const type = schema.type;
    if (type === 'string') {
        // Check for special string types
        if ((_a = schema.tests) === null || _a === void 0 ? void 0 : _a.some((t) => { var _a; return ((_a = t.OPTIONS) === null || _a === void 0 ? void 0 : _a.name) === 'email'; }))
            return 'email';
        if ((_b = schema.tests) === null || _b === void 0 ? void 0 : _b.some((t) => { var _a; return ((_a = t.OPTIONS) === null || _a === void 0 ? void 0 : _a.name) === 'url'; }))
            return 'url';
        // Check for long text (maxLength > 100 or explicitly text)
        const maxTest = (_c = schema.tests) === null || _c === void 0 ? void 0 : _c.find((t) => { var _a; return ((_a = t.OPTIONS) === null || _a === void 0 ? void 0 : _a.name) === 'max'; });
        if (maxTest && ((_e = (_d = maxTest.OPTIONS) === null || _d === void 0 ? void 0 : _d.params) === null || _e === void 0 ? void 0 : _e.max) > 100)
            return 'text';
        return 'string';
    }
    if (type === 'number')
        return 'number';
    if (type === 'boolean')
        return 'boolean';
    if (type === 'date')
        return 'date';
    if (type === 'array')
        return 'array';
    return 'string';
}
function extractFieldFromYup(name, schema) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const field = {
        name,
        type: getYupType(schema),
        label: ((_a = schema.spec) === null || _a === void 0 ? void 0 : _a.label) || formatLabel(name),
        required: !((_b = schema.spec) === null || _b === void 0 ? void 0 : _b.optional) && !((_c = schema.spec) === null || _c === void 0 ? void 0 : _c.nullable),
        defaultValue: (_d = schema.spec) === null || _d === void 0 ? void 0 : _d.default
    };
    // Extract validation constraints
    for (const test of schema.tests || []) {
        const params = (_e = test.OPTIONS) === null || _e === void 0 ? void 0 : _e.params;
        if (!params)
            continue;
        switch ((_f = test.OPTIONS) === null || _f === void 0 ? void 0 : _f.name) {
            case 'min':
                if (field.type === 'string')
                    field.minLength = params.min;
                else
                    field.min = params.min;
                break;
            case 'max':
                if (field.type === 'string')
                    field.maxLength = params.max;
                else
                    field.max = params.max;
                break;
            case 'length':
                field.minLength = params.length;
                field.maxLength = params.length;
                break;
        }
    }
    // Extract oneOf options
    if (((_h = (_g = schema._whitelist) === null || _g === void 0 ? void 0 : _g.list) === null || _h === void 0 ? void 0 : _h.size) > 0) {
        field.type = 'select';
        field.options = Array.from(schema._whitelist.list).map((value) => ({
            value,
            label: String(value)
        }));
    }
    return field;
}
function formatLabel(name) {
    return name
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, s => s.toUpperCase())
        .trim();
}
export function yupToForm(schema) {
    var _a, _b, _c, _d;
    const fields = [];
    // Get the schema description
    const desc = schema.describe();
    if (desc.type === 'object' && 'fields' in desc) {
        for (const [name, fieldDesc] of Object.entries(desc.fields)) {
            const field = {
                name,
                type: fieldDesc.type || 'string',
                label: fieldDesc.label || formatLabel(name),
                required: !fieldDesc.optional && !fieldDesc.nullable,
                defaultValue: fieldDesc.default
            };
            // Extract tests (validations)
            for (const test of fieldDesc.tests || []) {
                if (test.name === 'min') {
                    if (field.type === 'string')
                        field.minLength = (_a = test.params) === null || _a === void 0 ? void 0 : _a.min;
                    else
                        field.min = (_b = test.params) === null || _b === void 0 ? void 0 : _b.min;
                }
                if (test.name === 'max') {
                    if (field.type === 'string')
                        field.maxLength = (_c = test.params) === null || _c === void 0 ? void 0 : _c.max;
                    else
                        field.max = (_d = test.params) === null || _d === void 0 ? void 0 : _d.max;
                }
                if (test.name === 'email')
                    field.type = 'email';
                if (test.name === 'url')
                    field.type = 'url';
            }
            // Check for oneOf
            if (fieldDesc.oneOf && fieldDesc.oneOf.length > 0) {
                field.type = 'select';
                field.options = fieldDesc.oneOf.map((v) => ({ value: v, label: String(v) }));
            }
            // Text type for long strings
            if (field.type === 'string' && field.maxLength && field.maxLength > 100) {
                field.type = 'text';
            }
            fields.push(field);
        }
    }
    return fields;
}
// ============================================
// Action Registry
// ============================================
export class ActionRegistry {
    constructor() {
        this.actions = new Map();
    }
    /**
     * Register a new action
     */
    register(name, action) {
        if (this.actions.has(name)) {
            console.warn(`[ActionRegistry] Action "${name}" already exists, overwriting`);
        }
        this.actions.set(name, Object.assign({ name }, action));
        console.log(`[ActionRegistry] Registered: ${name}`);
    }
    /**
     * Extend an existing action
     */
    extend(name, extension) {
        const existing = this.actions.get(name);
        if (!existing) {
            console.warn(`[ActionRegistry] Action "${name}" not found, creating new`);
            this.register(name, extension);
            return;
        }
        this.actions.set(name, {
            name,
            meta: Object.assign(Object.assign({}, existing.meta), extension.meta),
            form: extension.form || existing.form,
            handler: extension.handler || existing.handler,
        });
    }
    /**
     * Check if action exists
     */
    has(name) {
        return this.actions.has(name);
    }
    /**
     * Get an action
     */
    get(name) {
        return this.actions.get(name);
    }
    /**
     * List all action names
     */
    list() {
        return Array.from(this.actions.keys());
    }
    /**
     * Execute an action
     */
    execute(name, record, data, req, context) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const action = this.actions.get(name);
            if (!action) {
                return { success: false, error: `Action "${name}" not found` };
            }
            // Validate with Yup schema
            if (action.form) {
                try {
                    yield action.form.validate(data, { abortEarly: false });
                }
                catch (err) {
                    const errors = ((_a = err.inner) === null || _a === void 0 ? void 0 : _a.map((e) => e.message)) || [err.message];
                    return { success: false, error: errors.join(', ') };
                }
            }
            try {
                return yield action.handler(record, data, req, context);
            }
            catch (error) {
                console.error(`[ActionRegistry] Error executing "${name}":`, error);
                return { success: false, error: error.message };
            }
        });
    }
    /**
     * Serialize an action for frontend (with form from Yup)
     */
    serialize(name) {
        const action = this.actions.get(name);
        if (!action)
            return null;
        return {
            name: action.name,
            meta: action.meta,
            form: action.form ? yupToForm(action.form) : undefined
        };
    }
    /**
     * Serialize multiple actions
     */
    serializeMany(names) {
        return names
            .map(name => this.serialize(name))
            .filter((a) => a !== null);
    }
}
