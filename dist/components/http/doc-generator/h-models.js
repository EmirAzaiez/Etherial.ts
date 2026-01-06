// Common types.  These should never be exposed directly but, instead, be cloned
// before being returned.  This avoids cross-contamination if a user modifies
// the their schema.
const ARRAY = { type: 'array' };
const BOOLEAN = { type: 'boolean' };
const INTEGER = { type: 'integer' };
const NULL = { type: 'null' };
const NUMBER = { type: 'number' };
const OBJECT = { type: 'object' };
const STRING = { type: 'string' };
// Note: per sec. 4.3.2 of spec, the "any" type can be `true` rather than an empty
// object.  While it makes the intent more explicit, having schemas always be
// Objects makes life easier for users of this module if/when they want to
// inspect or transform the generated schemas
const ANY = {};
const STRING_LENGTHS = { tiny: 255, medium: 16777215, long: 4294967295 };
// Naive utility for detecting empty objects
function _isEmpty(obj) {
    for (const k in obj)
        return false;
    return true;
}
function _includeAttribute(opts, name) {
    const include = (!opts.exclude || !opts.exclude.includes(name)) &&
        (!opts.attributes || opts.attributes.length <= 0 || opts.attributes.includes(name));
    return include;
}
// Naive utility for adding a type to schema.type
function _addType(schema, type = 'null') {
    // Empty schemas always validate
    if (_isEmpty(schema))
        return schema;
    if (!schema.type)
        throw Error('schema.type not defined');
    // Gather types and add type
    const types = new Set(Array.isArray(schema.type) ? schema.type : [schema.type]);
    types.add(type);
    // Update type field
    schema.type = types.size > 1 ? [...types][0] : [...types][0];
    if (types.size === 0) {
        schema.type = "string";
    }
    if (schema.type === null || schema.type === undefined || schema.type === '') {
        schema.type = "string";
    }
    return schema;
}
// Naive utility for removing a type to schema.type
function _removeType(schema, type = 'null') {
    if (!schema.type)
        throw Error('schema.type not defined');
    // Gather types and remove type
    const types = new Set(Array.isArray(schema.type) ? schema.type : [schema.type]);
    types.delete(type);
    // Note: Technically an empty type field is permissable, but the semantics of
    // that are complicated.  Is schema empty (always validates)?  Is it using one
    // of the combining properties (anyOf, oneOf, allOf, not)?  Getting this wrong
    // (e.g. producing an empty schema that always validates) could lead to
    // security vulenerabilities.  So we just throw here to force callers to
    // figure this out.
    if (types.size <= 0)
        throw Error('schema.type must have at least one type');
    // Update type field
    schema.type = types.size > 1 ? [...types] : [...types][0];
    return schema;
}
/**
 * Generate JSON schema for a Sequelize attribute
 *
 * @param {Attribute} att Sequelize attribute
 * @returns {Object} property schema
 */
function getAttributeSchema(att) {
    let schema;
    let attType = att && att.type && att.type.key;
    // NOTE: All known sequelize types should be mentioend in the switch blocks
    // below, either under aliases or transforms (but may be commented out if not
    // supported yet)
    // Aliases
    switch (attType) {
        case 'TEXT':
        case 'CITEXT':
            attType = 'STRING';
            break;
        case 'VIRTUAL': {
            if (!att.type.returnType)
                throw Error(`No type defined for VIRTUAL field "${att.field}"`);
            return getAttributeSchema(Object.assign(Object.assign({}, att), { type: att.type.returnType }));
        }
    }
    // Transforms (to schema property)
    switch (attType) {
        // ABSTRACT - not supported
        case 'ARRAY': {
            schema = Object.assign(Object.assign({}, ARRAY), { 
                // Sequelize requires att.type to be defined for ARRAYs
                items: getAttributeSchema({ type: att.type.type, allowNull: false }) });
            break;
        }
        case 'BIGINT': {
            schema = Object.assign(Object.assign({}, INTEGER), { format: 'int64' });
            break;
        }
        case 'BLOB': {
            schema = Object.assign(Object.assign({}, STRING), { contentEncoding: 'base64' });
            break;
        }
        case 'BOOLEAN': {
            schema = Object.assign({}, BOOLEAN);
            break;
        }
        case 'CHAR': {
            schema = Object.assign({}, STRING);
            break;
        }
        case 'CIDR': {
            schema = Object.assign({}, STRING);
            break;
        }
        case 'DATE': {
            schema = Object.assign(Object.assign({}, STRING), { format: 'date-time' });
            break;
        }
        case 'DATEONLY': {
            schema = Object.assign(Object.assign({}, STRING), { format: 'date' });
            break;
        }
        case 'DECIMAL': {
            schema = Object.assign({}, NUMBER);
            break;
        }
        // This is the `key` for DOUBLE datatypes... ¯\_(ツ)_/¯
        case 'DOUBLE PRECISION': {
            schema = Object.assign(Object.assign({}, NUMBER), { format: 'double' });
            break;
        }
        case 'ENUM': {
            schema = Object.assign(Object.assign({}, STRING), { enum: [...att.values] });
            break;
        }
        case 'FLOAT': {
            schema = Object.assign(Object.assign({}, NUMBER), { format: 'float' });
            break;
        }
        // GEOGRAPHY - needs definition
        // GEOMETRY - needs definition
        // HSTORE - needs definition
        case 'INET': {
            schema = { anyOf: [Object.assign(Object.assign({}, STRING), { format: 'ipv4' }), Object.assign(Object.assign({}, STRING), { format: 'ipv6' })] };
            break;
        }
        case 'INTEGER': {
            schema = Object.assign(Object.assign({}, INTEGER), { format: 'int32' });
            break;
        }
        case 'JSON': {
            schema = Object.assign({}, ANY);
            break;
        }
        case 'JSONB': {
            schema = Object.assign({}, ANY);
            break;
        }
        case 'MACADDR': {
            schema = Object.assign({}, STRING);
            break;
        }
        case 'MEDIUMINT': {
            schema = Object.assign({}, INTEGER);
            break;
        }
        // NOW: null,
        case 'NUMBER': {
            schema = Object.assign({}, NUMBER);
            break;
        }
        // RANGE: null,
        case 'REAL': {
            schema = Object.assign({}, NUMBER);
            break;
        }
        case 'SMALLINT': {
            schema = Object.assign({}, INTEGER);
            break;
        }
        case 'STRING': {
            schema = Object.assign({}, STRING);
            // Include max char length if available
            let length = att.type._length || (att.type.options && att.type.options.length);
            length = STRING_LENGTHS[length] || length;
            if (length)
                schema.maxLength = length;
            break;
        }
        case 'TIME': {
            schema = Object.assign(Object.assign({}, STRING), { format: 'time' });
            break;
        }
        case 'TINYINT': {
            schema = Object.assign({}, NUMBER);
            break;
        }
        case 'UUID': {
            schema = Object.assign(Object.assign({}, STRING), { format: 'uuid' });
            break;
        }
        case 'UUIDV1': {
            schema = Object.assign(Object.assign({}, STRING), { format: 'uuid' });
            break;
        }
        case 'UUIDV4': {
            schema = Object.assign(Object.assign({}, STRING), { format: 'uuid' });
            break;
        }
        case 'GEOMETRY': {
            schema = {
                type: "object",
                properties: {
                    type: {
                        type: "string",
                        enum: ["Point"],
                    },
                    coordinates: {
                        type: "array",
                        items: {
                            type: "number",
                        },
                    },
                },
            };
        }
        // case 'GEOMETRY("POINT")'
    }
    // Use ANY for anything that's not recognized.  'Not entirely sure
    // this is the right thing to do.  File an issue if you think it should behave
    // differently.
    if (!schema)
        schema = Object.assign({}, ANY);
    // Add null? (Sequelize allowNull defaults to true)
    if (att.allowNull !== false)
        schema = _addType(schema, 'null');
    return schema;
}
/**
 * Generate JSON Schema for a Sequelize Model
 *
 * @param {Model} model Sequelize.Model to schema-ify
 * @param {Object} options Optional options
 * @param {Array} options.attributes Attributes to include in schema
 * @param {Array} options.exclude  Attributes to exclude from schema (overrides
 * `attributes`)
 */
function getModelSchema(model, options = {}) {
    const schema = Object.assign(Object.assign({}, OBJECT), { properties: {}, required: [] });
    //@ts-ignore
    const { useRefs = true } = options;
    // Emit warnings about legacy options
    //@ts-ignore
    if (options.private) {
        throw Error('`private` option is deprecated (Use `exclude` instead)');
    }
    //@ts-ignore
    if (options.alwaysRequired) {
        throw Error('`alwaysRequired` option is no longer supported (Add required properties `schema.required[]` in the returned schema');
    }
    //@ts-ignore
    if (options.allowNull) {
        throw Error('`allowNull` option is no longer supported');
    }
    // Define propertiesk
    for (const attName of Object.keys(model.rawAttributes)) {
        if (!_includeAttribute(options, attName))
            continue;
        const att = model.rawAttributes[attName];
        if (att.references && useRefs !== false) {
            // Association references will get picked up in the next step, so don't
            // treat them as properties here
            continue;
        }
        if (!att)
            throw Error(`'${attName}' attribute not found in model`);
        schema.properties[attName] = getAttributeSchema(att);
        if (att.allowNull === false)
            schema.required.push(attName);
    }
    // Define associations(?)
    if (useRefs !== false) {
        for (const [, assoc] of Object.entries(model.associations)) {
            //@ts-ignore
            const { associationType, target, associationAccessor } = assoc;
            if (!_includeAttribute(options, associationAccessor))
                continue;
            let assSchema;
            switch (associationType) {
                case 'HasOne':
                case 'BelongsTo':
                    assSchema = { $ref: `#/components/schemas/${target.name}` };
                    break;
                case 'HasMany':
                case 'BelongsToMany':
                    assSchema = {
                        type: 'array',
                        items: { $ref: `#/components/schemas/${target.name}` }
                    };
                    break;
                default:
                    throw Error(`Unrecognized association type: "${associationType}"`);
            }
            schema.properties[associationAccessor] = assSchema;
        }
    }
    if (!schema.required.length)
        delete schema.required;
    return schema;
}
function getSequelizeSchema(seq, options = {}) {
    //@ts-ignore
    const { modelOptions = {} } = options;
    // Per https://json-schema.org/understanding-json-schema/structuring.htmlk
    const schema = Object.assign(Object.assign({ $schema: 'http://json-schema.org/draft-07/schema#' }, OBJECT), { definitions: {} });
    // Definitions
    for (const [name, model] of Object.entries(seq.models)) {
        const mopts = Object.assign({ exclude: [], attributes: [] }, modelOptions[name]);
        //@ts-ignore
        if (options.attributes)
            mopts.attributes.push(...options.attributes);
        //@ts-ignore
        if (options.exclude)
            mopts.exclude.push(...options.exclude);
        const modelSchema = getModelSchema(model, mopts);
        //@ts-ignore
        schema.definitions[model.name] = modelSchema;
    }
    return schema;
}
export { getAttributeSchema, getModelSchema, getSequelizeSchema, };
//# sourceMappingURL=h-models.js.map