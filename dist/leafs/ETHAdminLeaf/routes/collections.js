var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import etherial from 'etherial';
import { Controller, Get, Post, Put, Delete, } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { Op, fn, col } from 'sequelize';
const getAdminLeaf = () => etherial.eth_admin_leaf;
/**
 * Extract hasMany field definitions from collection fields
 * Resolves collection references to get the actual model
 */
function getHasManyFields(fields) {
    const result = new Map();
    if (!fields)
        return result;
    const adminLeaf = getAdminLeaf();
    for (const field of fields) {
        if (field.type === 'hasMany' && field.hasMany) {
            const hm = field.hasMany;
            // Resolve model from collection if not specified
            let resolvedModel = hm.model;
            if (!resolvedModel && hm.collection) {
                const refCollection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(hm.collection);
                resolvedModel = refCollection === null || refCollection === void 0 ? void 0 : refCollection.model;
            }
            result.set(field.name, Object.assign(Object.assign({}, hm), { label: field.label, resolvedModel }));
        }
    }
    return result;
}
/**
 * Extract belongsToMany field definitions from collection fields
 */
function getBelongsToManyFields(fields) {
    const result = new Map();
    if (!fields)
        return result;
    for (const field of fields) {
        if (field.type === 'belongsToMany' && field.belongsToMany) {
            result.set(field.name, Object.assign(Object.assign({}, field.belongsToMany), { label: field.label }));
        }
    }
    return result;
}
/**
 * Build Sequelize includes from hasMany and belongsToMany fields
 * This auto-generates the include array so you don't need to specify it manually
 */
function buildIncludesFromRelations(fields, existingIncludes) {
    const includes = existingIncludes ? [...existingIncludes] : [];
    const hasManyFields = getHasManyFields(fields);
    const belongsToManyFields = getBelongsToManyFields(fields);
    // Add hasMany includes
    for (const [fieldName, config] of hasManyFields) {
        const model = config.resolvedModel || config.model;
        const alreadyIncluded = includes.some(inc => inc.as === fieldName ||
            inc.association === fieldName ||
            inc.model === model);
        if (!alreadyIncluded) {
            // Get fields for nested includes:
            // 1. From hasMany.fields if they are FieldDefinition[]
            // 2. Or from the referenced collection's fields
            let fieldsArray = [];
            if (Array.isArray(config.fields) && config.fields.length > 0 && typeof config.fields[0] !== 'string') {
                fieldsArray = config.fields;
            }
            else if (config.collection) {
                // Lookup fields from referenced collection
                const adminLeaf = getAdminLeaf();
                const refCollection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(config.collection);
                if (refCollection === null || refCollection === void 0 ? void 0 : refCollection.fields) {
                    fieldsArray = refCollection.fields;
                }
            }
            const nestedIncludes = buildNestedIncludesForFields(fieldsArray);
            includes.push(Object.assign({ association: fieldName }, (nestedIncludes.length > 0 ? { include: nestedIncludes } : {})));
        }
    }
    // Add belongsToMany includes
    for (const [fieldName, config] of belongsToManyFields) {
        const alreadyIncluded = includes.some(inc => inc.as === fieldName ||
            inc.association === fieldName ||
            inc.model === config.model);
        if (!alreadyIncluded) {
            includes.push(Object.assign({ association: fieldName }, (config.pivotFields ? { through: { attributes: config.pivotFields.map(f => f.name) } } : {})));
        }
    }
    return includes;
}
/**
 * Build nested includes for media/relation fields in hasMany
 */
function buildNestedIncludesForFields(fields) {
    const includes = [];
    for (const field of fields) {
        if (field.type === 'media' || field.type === 'image' || field.type === 'file') {
            const assocName = field.name.replace(/_id$/, '');
            includes.push({ association: assocName });
        }
        if (field.type === 'relation' && field.relation) {
            const assocName = field.name.replace(/_id$/, '');
            includes.push({ association: assocName });
        }
    }
    return includes;
}
/**
 * Check if BelongsToManyInput contains pivot data (object format)
 */
function hasPivotData(items) {
    return items.length > 0 && typeof items[0] === 'object';
}
/**
 * Process belongsToMany relations after parent record is created/updated
 * Supports two formats (backward compatible):
 * - Simple: [1, 2, 3] → uses Sequelize set()
 * - With pivot: [{id: 5, through: {role: 2}}, {id: 8, through: {role: 1}}] → uses junction model directly
 */
function processBelongsToManyItems(record, fieldName, config, items) {
    return __awaiter(this, void 0, void 0, function* () {
        const stats = { added: 0, removed: 0 };
        if (!items || !Array.isArray(items)) {
            return stats;
        }
        try {
            if (items.length > 0 && hasPivotData(items)) {
                // Format with pivot data — use junction model directly
                const JunctionModel = typeof config.through === 'string' ? null : config.through;
                if (!JunctionModel) {
                    console.error(`[ETHAdminLeaf] Pivot fields require a junction model (not string) for ${fieldName}`);
                    return stats;
                }
                // Get current associations for stats
                const currentJunctions = yield JunctionModel.findAll({
                    where: { [config.foreignKey]: record.id },
                    raw: true
                });
                const currentOtherIds = new Set(currentJunctions.map((j) => j[config.otherKey]));
                // Remove all existing junction rows
                yield JunctionModel.destroy({ where: { [config.foreignKey]: record.id } });
                stats.removed = currentJunctions.length;
                // Create new junction rows with pivot data
                for (const item of items) {
                    yield JunctionModel.create(Object.assign({ [config.foreignKey]: record.id, [config.otherKey]: item.id }, (item.through || {})));
                    if (!currentOtherIds.has(item.id)) {
                        stats.added++;
                    }
                }
                // Adjust stats: items that were re-created aren't truly "added"
                stats.added = items.filter(item => !currentOtherIds.has(item.id)).length;
                stats.removed = currentJunctions.filter((j) => !items.some(item => item.id === j[config.otherKey])).length;
            }
            else {
                // Simple ID format — use Sequelize's set method
                const itemIds = items;
                const setMethodName = `set${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`;
                if (typeof record[setMethodName] === 'function') {
                    const getMethodName = `get${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`;
                    const currentItems = typeof record[getMethodName] === 'function'
                        ? yield record[getMethodName]()
                        : [];
                    const currentIds = new Set(currentItems.map((item) => item.id));
                    yield record[setMethodName](itemIds);
                    const newIds = new Set(itemIds);
                    for (const id of itemIds) {
                        if (!currentIds.has(id))
                            stats.added++;
                    }
                    for (const id of currentIds) {
                        if (!newIds.has(id))
                            stats.removed++;
                    }
                }
            }
        }
        catch (err) {
            console.error(`[ETHAdminLeaf] Error processing belongsToMany ${fieldName}:`, err.message);
        }
        return stats;
    });
}
/**
 * Process hasMany items after parent record is created/updated
 */
function processHasManyItems(parentId, _fieldName, config, items, isUpdate) {
    return __awaiter(this, void 0, void 0, function* () {
        const stats = { created: 0, updated: 0, deleted: 0 };
        if (!items || !Array.isArray(items)) {
            return stats;
        }
        // Use resolvedModel (from collection) or direct model
        const Model = config.resolvedModel || config.model;
        if (!Model) {
            console.error('[ETHAdminLeaf] No model found for hasMany field');
            return stats;
        }
        if (isUpdate) {
            // For updates: sync items (create new, update existing, delete removed)
            const existingItems = yield Model.findAll({
                where: { [config.foreignKey]: parentId }
            });
            const existingIds = new Set(existingItems.map((item) => item.id));
            const newIds = new Set(items.filter(item => item.id).map(item => item.id));
            // Delete items that are no longer in the list
            for (const existing of existingItems) {
                if (!newIds.has(existing.id)) {
                    yield existing.destroy();
                    stats.deleted++;
                }
            }
            // Create or update items
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const itemData = Object.assign(Object.assign({}, item), { [config.foreignKey]: parentId, [config.orderField || 'order']: i });
                if (item.id && existingIds.has(item.id)) {
                    // Update existing
                    const existing = existingItems.find((e) => e.id === item.id);
                    if (existing) {
                        yield existing.update(itemData);
                        stats.updated++;
                    }
                }
                else {
                    // Create new (remove id if it was set but doesn't exist)
                    delete itemData.id;
                    yield Model.create(itemData);
                    stats.created++;
                }
            }
        }
        else {
            // For creates: just create all items
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const itemData = Object.assign(Object.assign({}, item), { [config.foreignKey]: parentId, [config.orderField || 'order']: i });
                delete itemData.id; // Remove any client-side temp id
                yield Model.create(itemData);
                stats.created++;
            }
        }
        return stats;
    });
}
/**
 * Mask a string value for secure display
 * Shows first 5 chars, 5 dots, last 5 chars
 * For shorter strings, adjusts accordingly
 */
function maskSecureValue(value) {
    if (!value || typeof value !== 'string')
        return value;
    const len = value.length;
    if (len <= 10) {
        // Too short to mask meaningfully
        return value.substring(0, 2) + '•••' + value.substring(len - 2);
    }
    const showChars = Math.min(5, Math.floor(len / 3));
    const start = value.substring(0, showChars);
    const end = value.substring(len - showChars);
    return `${start}•••••${end}`;
}
/**
 * Transform field values for Admin API responses:
 * - Enum fields: convert numeric values to labels
 * - Secure fields: mask sensitive data
 */
function transformFields(items, fields) {
    // Build maps for transformations
    const optionsMap = {};
    const secureFields = new Set();
    const jsonFields = new Set();
    const relationFields = new Map();
    for (const field of fields) {
        // Collect enum options
        if (field.options && Array.isArray(field.options)) {
            optionsMap[field.name] = {};
            for (const opt of field.options) {
                optionsMap[field.name][opt.value] = opt.label;
            }
        }
        // Collect secure fields
        if (field.secure) {
            secureFields.add(field.name);
        }
        // Collect json fields
        if (field.type === 'json') {
            jsonFields.add(field.name);
        }
        // Collect relation fields
        if (field.type === 'relation' && field.relation) {
            relationFields.set(field.name, field.relation);
        }
    }
    // Transform each item
    return items.map(item => {
        let json = item.toJSON ? item.toJSON() : Object.assign({}, item);
        // Apply custom field type afterRead hooks
        json = applyAfterRead(json, fields);
        // Apply enum transformations
        for (const [fieldName, valueToLabel] of Object.entries(optionsMap)) {
            if (json[fieldName] !== undefined && valueToLabel[json[fieldName]]) {
                json[fieldName] = valueToLabel[json[fieldName]];
            }
        }
        // Apply secure masking
        for (const fieldName of secureFields) {
            if (json[fieldName] !== undefined) {
                json[fieldName] = maskSecureValue(json[fieldName]);
            }
        }
        // Format JSON fields for readable display
        for (const fieldName of jsonFields) {
            const val = json[fieldName];
            if (val == null)
                continue;
            if (Array.isArray(val)) {
                json[fieldName] = val.map((item) => {
                    if (typeof item === 'object') {
                        // Show most meaningful values: name, value, url, key
                        return item.name || item.value || item.url || item.key || JSON.stringify(item);
                    }
                    return String(item);
                });
            }
            else if (typeof val === 'object') {
                json[fieldName] = JSON.stringify(val, null, 2);
            }
        }
        // Resolve relation display fields (user_id: 5 → user_id: "email@test.com")
        for (const [fieldName, relConfig] of relationFields) {
            const associationName = fieldName.replace(/_id$/, '');
            const related = json[associationName];
            if (related && related[relConfig.displayField]) {
                json[fieldName] = related[relConfig.displayField];
            }
        }
        return json;
    });
}
/**
 * Get CDN URL from ETHMediaLeaf config
 */
function getCdnUrl() {
    var _a, _b;
    try {
        const etherial = require('etherial').default;
        return (_b = (_a = etherial === null || etherial === void 0 ? void 0 : etherial.eth_media_leaf) === null || _a === void 0 ? void 0 : _a.config) === null || _b === void 0 ? void 0 : _b.cdn_url;
    }
    catch (_c) {
        return undefined;
    }
}
/**
 * Check if an object looks like a Media record
 */
function isMediaObject(obj) {
    return obj &&
        typeof obj === 'object' &&
        typeof obj.key === 'string' &&
        typeof obj.folder === 'string' &&
        (obj.mime_type || obj.file_size !== undefined);
}
/**
 * Recursively transform all Media objects in data to include CDN URL
 * This adds a `url` property to any object that looks like a Media record
 */
function transformMediaUrls(data, cdnUrl) {
    if (!cdnUrl) {
        cdnUrl = getCdnUrl();
    }
    if (!cdnUrl || !data)
        return data;
    // Handle arrays
    if (Array.isArray(data)) {
        return data.map(item => transformMediaUrls(item, cdnUrl));
    }
    // Handle objects
    if (typeof data === 'object') {
        // Convert Sequelize instance to plain object
        const obj = data.toJSON ? data.toJSON() : Object.assign({}, data);
        // Check if this object is a Media
        if (isMediaObject(obj) && !obj.url) {
            obj.url = `${cdnUrl.replace(/\/$/, '')}/${obj.key}`;
        }
        // Recursively transform nested objects
        for (const key of Object.keys(obj)) {
            if (obj[key] && typeof obj[key] === 'object') {
                obj[key] = transformMediaUrls(obj[key], cdnUrl);
            }
        }
        return obj;
    }
    return data;
}
/**
 * Process custom field types for create/update operations
 * Runs beforeSave and validate hooks for any fields that use custom types
 */
function processCustomFieldTypes(data, fields, phase) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!fields)
            return data;
        const adminLeaf = getAdminLeaf();
        const result = Object.assign({}, data);
        for (const field of fields) {
            const customType = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCustomFieldType(field.type);
            if (!customType)
                continue;
            const value = result[field.name];
            if (value === undefined)
                continue;
            if (phase === 'beforeSave' && customType.beforeSave) {
                result[field.name] = customType.beforeSave(value, field);
            }
            if (phase === 'validate' && customType.validate) {
                yield customType.validate(value, field);
            }
        }
        return result;
    });
}
/**
 * Apply afterRead hooks for custom field types
 */
function applyAfterRead(data, fields) {
    if (!fields)
        return data;
    const adminLeaf = getAdminLeaf();
    const result = Object.assign({}, data);
    for (const field of fields) {
        const customType = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCustomFieldType(field.type);
        if (!(customType === null || customType === void 0 ? void 0 : customType.afterRead))
            continue;
        if (result[field.name] !== undefined) {
            result[field.name] = customType.afterRead(result[field.name], field);
        }
    }
    return result;
}
/**
 * Parse advanced filters from query parameters
 * Supports Django-style double-underscore operators:
 * - field=value → exact match (backward compatible)
 * - field__ne=value → not equal
 * - field__gt, field__gte, field__lt, field__lte → comparisons
 * - field__between=start,end → range
 * - field__in=val1,val2,val3 → IN
 * - field__null=true/false → IS NULL / IS NOT NULL
 * - field__like=pattern → LIKE
 */
function parseAdvancedFilters(filters, allowedFilters) {
    const where = {};
    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === '')
            continue;
        // Check for operator suffix
        const parts = key.split('__');
        const fieldName = parts[0];
        const operator = parts[1];
        // Whitelist check on the base field name
        if (!allowedFilters.includes(fieldName))
            continue;
        if (!operator) {
            // Simple exact match (backward compatible)
            where[fieldName] = value;
            continue;
        }
        switch (operator) {
            case 'ne':
                where[fieldName] = { [Op.ne]: value };
                break;
            case 'gt':
                where[fieldName] = Object.assign(Object.assign({}, where[fieldName]), { [Op.gt]: value });
                break;
            case 'gte':
                where[fieldName] = Object.assign(Object.assign({}, where[fieldName]), { [Op.gte]: value });
                break;
            case 'lt':
                where[fieldName] = Object.assign(Object.assign({}, where[fieldName]), { [Op.lt]: value });
                break;
            case 'lte':
                where[fieldName] = Object.assign(Object.assign({}, where[fieldName]), { [Op.lte]: value });
                break;
            case 'between': {
                const [start, end] = String(value).split(',');
                if (start && end) {
                    where[fieldName] = { [Op.between]: [start.trim(), end.trim()] };
                }
                break;
            }
            case 'in': {
                const values = String(value).split(',').map(v => v.trim());
                where[fieldName] = { [Op.in]: values };
                break;
            }
            case 'null':
                where[fieldName] = String(value) === 'true' ? null : { [Op.ne]: null };
                break;
            case 'like':
                where[fieldName] = { [Op.like]: value };
                break;
            default:
                // Unknown operator, treat as exact match on full key
                break;
        }
    }
    return where;
}
/**
 * Escape a value for CSV output
 */
function escapeCsvValue(value) {
    if (value === null || value === undefined)
        return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}
/**
 * Admin Collections Controller
 * Single controller handling all CRUD operations for all collections
 */
let AdminCollectionsController = class AdminCollectionsController {
    /**
     * GET /admin/collections/:collection
     * List records from a collection
     */
    list(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            const { collection: collectionName } = req.params;
            const adminLeaf = getAdminLeaf();
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['collection_not_found'] });
            }
            // Check access
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, 'list'));
            if (!hasAccess) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 403, errors: ['forbidden'] });
            }
            try {
                const _l = req.query, { limit = 25, offset = 0, sort, order, search, showDeleted } = _l, filters = __rest(_l, ["limit", "offset", "sort", "order", "search", "showDeleted"]);
                const listView = (_e = collection.views) === null || _e === void 0 ? void 0 : _e.list;
                // Build where clause from advanced filters
                const allowedFilters = (listView === null || listView === void 0 ? void 0 : listView.filters) || [];
                const where = parseAdvancedFilters(filters, allowedFilters);
                // Build search clause
                if (search && (listView === null || listView === void 0 ? void 0 : listView.search) && listView.search.length > 0) {
                    where[Op.or] = listView.search.map((field) => ({
                        [field]: { [Op.iLike]: `%${search}%` }
                    }));
                }
                // Build order
                let orderClause = [];
                if (sort) {
                    orderClause = [[sort, (order || 'ASC').toUpperCase()]];
                }
                else if (listView === null || listView === void 0 ? void 0 : listView.sort) {
                    orderClause = [[listView.sort.field, listView.sort.direction.toUpperCase()]];
                }
                else {
                    orderClause = [['created_at', 'DESC']];
                }
                // Soft delete: show deleted records if requested and collection supports it
                const paranoidOption = ((_f = collection.softDelete) === null || _f === void 0 ? void 0 : _f.enabled) && showDeleted === 'true'
                    ? { paranoid: false }
                    : {};
                const result = yield collection.model.findAndCountAll(Object.assign({ where, attributes: listView === null || listView === void 0 ? void 0 : listView.fields, include: (listView === null || listView === void 0 ? void 0 : listView.include) || [], order: orderClause, limit: Number(limit), offset: Number(offset) }, paranoidOption));
                // Transform field values for admin display (enums, secure fields)
                const transformedItems = transformFields(result.rows, collection.fields || []);
                // Add CDN URLs to all media objects
                const itemsWithUrls = transformMediaUrls(transformedItems);
                return (_h = (_g = res).success) === null || _h === void 0 ? void 0 : _h.call(_g, {
                    status: 200,
                    data: { items: itemsWithUrls, total: result.count }
                });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] List error for ${collectionName}:`, err);
                return (_k = (_j = res).error) === null || _k === void 0 ? void 0 : _k.call(_j, { status: 400, errors: [err.message] });
            }
        });
    }
    /**
     * GET /admin/collections/:collection/:id
     * Show a single record
     */
    show(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            const { collection: collectionName, id } = req.params;
            const { raw } = req.query;
            const adminLeaf = getAdminLeaf();
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['collection_not_found'] });
            }
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, 'show'));
            if (!hasAccess) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 403, errors: ['forbidden'] });
            }
            try {
                const showView = (_e = collection.views) === null || _e === void 0 ? void 0 : _e.show;
                // Auto-generate includes from hasMany + belongsToMany fields + any manual includes
                const includes = buildIncludesFromRelations(collection.fields, showView === null || showView === void 0 ? void 0 : showView.include);
                const record = yield collection.model.findByPk(id, {
                    include: includes
                });
                if (!record) {
                    return (_g = (_f = res).error) === null || _g === void 0 ? void 0 : _g.call(_f, { status: 404, errors: ['not_found'] });
                }
                // raw=true: skip enum/secure transformations (used by edit forms to get raw values)
                if (raw === 'true') {
                    const rawData = record.toJSON ? record.toJSON() : Object.assign({}, record);
                    const recordWithUrls = transformMediaUrls(rawData);
                    return (_j = (_h = res).success) === null || _j === void 0 ? void 0 : _j.call(_h, { status: 200, data: recordWithUrls });
                }
                // Transform field values for admin display (enums, secure fields)
                const [transformedRecord] = transformFields([record], collection.fields || []);
                // Add CDN URLs to all media objects
                const recordWithUrls = transformMediaUrls(transformedRecord);
                return (_l = (_k = res).success) === null || _l === void 0 ? void 0 : _l.call(_k, { status: 200, data: recordWithUrls });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] Show error for ${collectionName}:`, err);
                return (_o = (_m = res).error) === null || _o === void 0 ? void 0 : _o.call(_m, { status: 400, errors: [err.message] });
            }
        });
    }
    /**
     * GET /admin/collections/:collection/:id/collections/:subName
     * Get sub-collection records
     * Supports both manual collections config AND auto-generated from hasMany fields
     */
    subCollection(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            const { collection: collectionName, id, subName } = req.params;
            const adminLeaf = getAdminLeaf();
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['collection_not_found'] });
            }
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, 'show'));
            if (!hasAccess) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 403, errors: ['forbidden'] });
            }
            // First check manual collections config
            let subConfig = (_g = (_f = (_e = collection.views) === null || _e === void 0 ? void 0 : _e.show) === null || _f === void 0 ? void 0 : _f.collections) === null || _g === void 0 ? void 0 : _g.find((s) => s.name === subName);
            // If not found, check hasMany fields (auto-generated sub-collections)
            if (!subConfig) {
                const hasManyFields = getHasManyFields(collection.fields);
                const hasManyConfig = hasManyFields.get(subName);
                if (hasManyConfig) {
                    // Get model from resolvedModel (collection lookup) or direct model
                    const model = hasManyConfig.resolvedModel || hasManyConfig.model;
                    // Get field names from fields config
                    let fieldNames = [];
                    if (hasManyConfig.fields && Array.isArray(hasManyConfig.fields)) {
                        if (typeof hasManyConfig.fields[0] === 'string') {
                            fieldNames = hasManyConfig.fields;
                        }
                        else {
                            fieldNames = hasManyConfig.fields.map((f) => f.name);
                        }
                    }
                    // Convert hasMany to subConfig format
                    subConfig = {
                        name: subName,
                        title: hasManyConfig.label || subName,
                        model,
                        foreignKey: hasManyConfig.foreignKey,
                        fields: fieldNames,
                        sort: hasManyConfig.sortable ? { field: hasManyConfig.orderField || 'order', direction: 'asc' } : undefined
                    };
                }
            }
            if (!subConfig) {
                return (_j = (_h = res).error) === null || _j === void 0 ? void 0 : _j.call(_h, { status: 404, errors: ['sub_collection_not_found'] });
            }
            try {
                const { limit = subConfig.limit || 25, offset = 0 } = req.query;
                const order = subConfig.sort
                    ? [[subConfig.sort.field, subConfig.sort.direction.toUpperCase()]]
                    : [['created_at', 'DESC']];
                // Build includes for nested relations (media, etc)
                const hasManyFields = getHasManyFields(collection.fields);
                const hasManyConfig = hasManyFields.get(subName);
                // Get field definitions (handling string[] vs FieldDefinition[])
                let fieldsForIncludes = [];
                if ((hasManyConfig === null || hasManyConfig === void 0 ? void 0 : hasManyConfig.fields) && Array.isArray(hasManyConfig.fields)) {
                    if (typeof hasManyConfig.fields[0] !== 'string') {
                        fieldsForIncludes = hasManyConfig.fields;
                    }
                }
                const nestedIncludes = buildNestedIncludesForFields(fieldsForIncludes);
                // M:M: query via junction table, then fetch related model
                let items;
                if (subConfig.through && subConfig.otherKey) {
                    const junctionRows = yield subConfig.through.findAll({
                        where: { [subConfig.foreignKey]: id },
                        attributes: [subConfig.otherKey],
                        raw: true,
                    });
                    const relatedIds = junctionRows.map((r) => r[subConfig.otherKey]).filter(Boolean);
                    if (relatedIds.length === 0) {
                        items = { rows: [], count: 0 };
                    }
                    else {
                        items = yield subConfig.model.findAndCountAll({
                            where: { id: relatedIds },
                            include: nestedIncludes,
                            order,
                            limit: Number(limit),
                            offset: Number(offset),
                        });
                    }
                }
                else {
                    items = yield subConfig.model.findAndCountAll({
                        where: { [subConfig.foreignKey]: id },
                        include: nestedIncludes,
                        order,
                        limit: Number(limit),
                        offset: Number(offset)
                    });
                }
                // Try to get the sub-collection's registered fields for transformation
                const subCollection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(subName);
                // Prefer collection fields, then hasMany fields if they're FieldDefinition[]
                let subFields = (subCollection === null || subCollection === void 0 ? void 0 : subCollection.fields) || [];
                if (subFields.length === 0 && fieldsForIncludes.length > 0) {
                    subFields = fieldsForIncludes;
                }
                const transformedItems = transformFields(items.rows, subFields);
                // Add CDN URLs to all media objects
                const itemsWithUrls = transformMediaUrls(transformedItems);
                return (_l = (_k = res).success) === null || _l === void 0 ? void 0 : _l.call(_k, {
                    status: 200,
                    data: { items: itemsWithUrls, total: items.count }
                });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] SubCollection error:`, err);
                return (_o = (_m = res).error) === null || _o === void 0 ? void 0 : _o.call(_m, { status: 400, errors: [err.message] });
            }
        });
    }
    /**
     * POST /admin/collections/:collection
     * Create a new record
     */
    create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            const { collection: collectionName } = req.params;
            const adminLeaf = getAdminLeaf();
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['collection_not_found'] });
            }
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, 'create'));
            if (!hasAccess) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 403, errors: ['forbidden'] });
            }
            try {
                let data = Object.assign({}, req.body);
                const resolvedHooks = adminLeaf.getResolvedHooks(collectionName);
                // Extract hasMany fields from data
                const hasManyFields = getHasManyFields(collection.fields);
                const hasManyData = new Map();
                for (const [fieldName] of hasManyFields) {
                    if (data[fieldName] !== undefined) {
                        hasManyData.set(fieldName, data[fieldName]);
                        delete data[fieldName];
                    }
                }
                // Extract belongsToMany fields from data
                const belongsToManyFields = getBelongsToManyFields(collection.fields);
                const belongsToManyData = new Map();
                for (const [fieldName] of belongsToManyFields) {
                    if (data[fieldName] !== undefined) {
                        belongsToManyData.set(fieldName, data[fieldName]);
                        delete data[fieldName];
                    }
                }
                // Run beforeCreate hook
                if (resolvedHooks === null || resolvedHooks === void 0 ? void 0 : resolvedHooks.beforeCreate) {
                    data = (_e = yield resolvedHooks.beforeCreate(data, req)) !== null && _e !== void 0 ? _e : data;
                }
                // Process custom field types: validate then beforeSave
                data = yield processCustomFieldTypes(data, collection.fields, 'validate');
                data = yield processCustomFieldTypes(data, collection.fields, 'beforeSave');
                // Create parent record
                const record = yield collection.model.create(data);
                // Create hasMany items
                for (const [fieldName, items] of hasManyData) {
                    const hmConfig = hasManyFields.get(fieldName);
                    yield processHasManyItems(record.id, fieldName, hmConfig, items, false);
                }
                // Sync belongsToMany relations
                for (const [fieldName, itemIds] of belongsToManyData) {
                    const btmConfig = belongsToManyFields.get(fieldName);
                    yield processBelongsToManyItems(record, fieldName, btmConfig, itemIds);
                }
                // Run afterCreate hook
                if (resolvedHooks === null || resolvedHooks === void 0 ? void 0 : resolvedHooks.afterCreate) {
                    yield resolvedHooks.afterCreate(record, req);
                }
                // Reload with relations
                const reloadIncludes = [];
                if (hasManyData.size > 0) {
                    reloadIncludes.push(...Array.from(hasManyFields.keys()).map(name => ({ association: name })));
                }
                if (belongsToManyData.size > 0) {
                    reloadIncludes.push(...Array.from(belongsToManyFields.keys()).map(name => ({ association: name })));
                }
                if (reloadIncludes.length > 0) {
                    yield record.reload({ include: reloadIncludes });
                }
                return (_g = (_f = res).success) === null || _g === void 0 ? void 0 : _g.call(_f, { status: 201, data: record });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] Create error for ${collectionName}:`, err);
                return (_j = (_h = res).error) === null || _j === void 0 ? void 0 : _j.call(_h, { status: 400, errors: ((_k = err.errors) === null || _k === void 0 ? void 0 : _k.map((e) => e.message)) || [err.message] });
            }
        });
    }
    /**
     * PUT /admin/collections/:collection/:id
     * Update a record
     */
    update(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
            const { collection: collectionName, id } = req.params;
            const adminLeaf = getAdminLeaf();
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['collection_not_found'] });
            }
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, 'update'));
            if (!hasAccess) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 403, errors: ['forbidden'] });
            }
            try {
                const record = yield collection.model.findByPk(id);
                if (!record) {
                    return (_f = (_e = res).error) === null || _f === void 0 ? void 0 : _f.call(_e, { status: 404, errors: ['not_found'] });
                }
                let data = Object.assign({}, req.body);
                const resolvedHooks = adminLeaf.getResolvedHooks(collectionName);
                // Extract hasMany fields from data
                const hasManyFields = getHasManyFields(collection.fields);
                const hasManyData = new Map();
                for (const [fieldName] of hasManyFields) {
                    if (data[fieldName] !== undefined) {
                        hasManyData.set(fieldName, data[fieldName]);
                        delete data[fieldName];
                    }
                }
                // Extract belongsToMany fields from data
                const belongsToManyFields = getBelongsToManyFields(collection.fields);
                const belongsToManyData = new Map();
                for (const [fieldName] of belongsToManyFields) {
                    if (data[fieldName] !== undefined) {
                        belongsToManyData.set(fieldName, data[fieldName]);
                        delete data[fieldName];
                    }
                }
                // Run beforeUpdate hook
                if (resolvedHooks === null || resolvedHooks === void 0 ? void 0 : resolvedHooks.beforeUpdate) {
                    data = (_g = yield resolvedHooks.beforeUpdate(record, data, req)) !== null && _g !== void 0 ? _g : data;
                }
                // Process custom field types: validate then beforeSave
                data = yield processCustomFieldTypes(data, collection.fields, 'validate');
                data = yield processCustomFieldTypes(data, collection.fields, 'beforeSave');
                // Update parent record
                yield record.update(data);
                // Sync hasMany items
                for (const [fieldName, items] of hasManyData) {
                    const hmConfig = hasManyFields.get(fieldName);
                    yield processHasManyItems(record.id, fieldName, hmConfig, items, true);
                }
                // Sync belongsToMany relations
                for (const [fieldName, itemIds] of belongsToManyData) {
                    const btmConfig = belongsToManyFields.get(fieldName);
                    yield processBelongsToManyItems(record, fieldName, btmConfig, itemIds);
                }
                // Run afterUpdate hook
                if (resolvedHooks === null || resolvedHooks === void 0 ? void 0 : resolvedHooks.afterUpdate) {
                    yield resolvedHooks.afterUpdate(record, req);
                }
                // Reload with relations
                const reloadIncludes = [];
                if (hasManyData.size > 0) {
                    reloadIncludes.push(...Array.from(hasManyFields.keys()).map(name => ({ association: name })));
                }
                if (belongsToManyData.size > 0) {
                    reloadIncludes.push(...Array.from(belongsToManyFields.keys()).map(name => ({ association: name })));
                }
                if (reloadIncludes.length > 0) {
                    yield record.reload({ include: reloadIncludes });
                }
                return (_j = (_h = res).success) === null || _j === void 0 ? void 0 : _j.call(_h, { status: 200, data: record });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] Update error for ${collectionName}:`, err);
                return (_l = (_k = res).error) === null || _l === void 0 ? void 0 : _l.call(_k, { status: 400, errors: ((_m = err.errors) === null || _m === void 0 ? void 0 : _m.map((e) => e.message)) || [err.message] });
            }
        });
    }
    /**
     * DELETE /admin/collections/:collection/:id
     * Delete a record
     */
    delete(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
            const { collection: collectionName, id } = req.params;
            const adminLeaf = getAdminLeaf();
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['collection_not_found'] });
            }
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, 'delete'));
            if (!hasAccess) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 403, errors: ['forbidden'] });
            }
            try {
                const record = yield collection.model.findByPk(id);
                if (!record) {
                    return (_f = (_e = res).error) === null || _f === void 0 ? void 0 : _f.call(_e, { status: 404, errors: ['not_found'] });
                }
                const resolvedHooks = adminLeaf.getResolvedHooks(collectionName);
                // Run beforeDelete hook
                if (resolvedHooks === null || resolvedHooks === void 0 ? void 0 : resolvedHooks.beforeDelete) {
                    const canDelete = yield resolvedHooks.beforeDelete(record, req);
                    if (canDelete === false) {
                        return (_h = (_g = res).error) === null || _h === void 0 ? void 0 : _h.call(_g, { status: 400, errors: ['delete_prevented'] });
                    }
                }
                yield record.destroy();
                // Run afterDelete hook
                if (resolvedHooks === null || resolvedHooks === void 0 ? void 0 : resolvedHooks.afterDelete) {
                    yield resolvedHooks.afterDelete(record, req);
                }
                return (_k = (_j = res).success) === null || _k === void 0 ? void 0 : _k.call(_j, { status: 200, data: { deleted: true } });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] Delete error for ${collectionName}:`, err);
                return (_m = (_l = res).error) === null || _m === void 0 ? void 0 : _m.call(_l, { status: 400, errors: [err.message] });
            }
        });
    }
    /**
     * GET /admin/collections/:collection/:id/collections/:subName/:subId
     * Show a single sub-collection record
     */
    showSubCollectionItem(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
            const { collection: collectionName, id, subName, subId } = req.params;
            const adminLeaf = getAdminLeaf();
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['collection_not_found'] });
            }
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, 'show'));
            if (!hasAccess) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 403, errors: ['forbidden'] });
            }
            const subConfig = (_g = (_f = (_e = collection.views) === null || _e === void 0 ? void 0 : _e.show) === null || _f === void 0 ? void 0 : _f.collections) === null || _g === void 0 ? void 0 : _g.find((s) => s.name === subName);
            if (!subConfig) {
                return (_j = (_h = res).error) === null || _j === void 0 ? void 0 : _j.call(_h, { status: 404, errors: ['sub_collection_not_found'] });
            }
            try {
                const record = yield subConfig.model.findOne({
                    where: {
                        id: subId,
                        [subConfig.foreignKey]: id
                    }
                });
                if (!record) {
                    return (_l = (_k = res).error) === null || _l === void 0 ? void 0 : _l.call(_k, { status: 404, errors: ['not_found'] });
                }
                return (_o = (_m = res).success) === null || _o === void 0 ? void 0 : _o.call(_m, { status: 200, data: record });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] ShowSubCollectionItem error:`, err);
                return (_q = (_p = res).error) === null || _q === void 0 ? void 0 : _q.call(_p, { status: 400, errors: [err.message] });
            }
        });
    }
    /**
     * PUT /admin/collections/:collection/:id/collections/:subName/:subId
     * Update a sub-collection record
     */
    updateSubCollectionItem(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
            const { collection: collectionName, id, subName, subId } = req.params;
            const adminLeaf = getAdminLeaf();
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['collection_not_found'] });
            }
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, 'update'));
            if (!hasAccess) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 403, errors: ['forbidden'] });
            }
            const subConfig = (_g = (_f = (_e = collection.views) === null || _e === void 0 ? void 0 : _e.show) === null || _f === void 0 ? void 0 : _f.collections) === null || _g === void 0 ? void 0 : _g.find((s) => s.name === subName);
            if (!subConfig) {
                return (_j = (_h = res).error) === null || _j === void 0 ? void 0 : _j.call(_h, { status: 404, errors: ['sub_collection_not_found'] });
            }
            try {
                const record = yield subConfig.model.findOne({
                    where: {
                        id: subId,
                        [subConfig.foreignKey]: id
                    }
                });
                if (!record) {
                    return (_l = (_k = res).error) === null || _l === void 0 ? void 0 : _l.call(_k, { status: 404, errors: ['not_found'] });
                }
                yield record.update(req.body);
                return (_o = (_m = res).success) === null || _o === void 0 ? void 0 : _o.call(_m, { status: 200, data: record });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] UpdateSubCollectionItem error:`, err);
                return (_q = (_p = res).error) === null || _q === void 0 ? void 0 : _q.call(_p, { status: 400, errors: ((_r = err.errors) === null || _r === void 0 ? void 0 : _r.map((e) => e.message)) || [err.message] });
            }
        });
    }
    /**
     * DELETE /admin/collections/:collection/:id/collections/:subName/:subId
     * Delete a sub-collection record
     */
    deleteSubCollectionItem(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
            const { collection: collectionName, id, subName, subId } = req.params;
            const adminLeaf = getAdminLeaf();
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['collection_not_found'] });
            }
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, 'delete'));
            if (!hasAccess) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 403, errors: ['forbidden'] });
            }
            const subConfig = (_g = (_f = (_e = collection.views) === null || _e === void 0 ? void 0 : _e.show) === null || _f === void 0 ? void 0 : _f.collections) === null || _g === void 0 ? void 0 : _g.find((s) => s.name === subName);
            if (!subConfig) {
                return (_j = (_h = res).error) === null || _j === void 0 ? void 0 : _j.call(_h, { status: 404, errors: ['sub_collection_not_found'] });
            }
            try {
                const record = yield subConfig.model.findOne({
                    where: {
                        id: subId,
                        [subConfig.foreignKey]: id
                    }
                });
                if (!record) {
                    return (_l = (_k = res).error) === null || _l === void 0 ? void 0 : _l.call(_k, { status: 404, errors: ['not_found'] });
                }
                yield record.destroy();
                return (_o = (_m = res).success) === null || _o === void 0 ? void 0 : _o.call(_m, { status: 200, data: { deleted: true } });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] DeleteSubCollectionItem error:`, err);
                return (_q = (_p = res).error) === null || _q === void 0 ? void 0 : _q.call(_p, { status: 400, errors: [err.message] });
            }
        });
    }
    /**
     * POST /admin/collections/:collection/:id/collections/:subName/:subId/actions
     * Execute an action on a sub-collection record
     */
    executeSubCollectionAction(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
            const { collection: collectionName, id, subName, subId } = req.params;
            const _x = req.body, { action: actionName } = _x, formData = __rest(_x, ["action"]);
            const adminLeaf = getAdminLeaf();
            if (!actionName) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 400, errors: ['action_required'] });
            }
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 404, errors: ['collection_not_found'] });
            }
            const subConfig = (_g = (_f = (_e = collection.views) === null || _e === void 0 ? void 0 : _e.show) === null || _f === void 0 ? void 0 : _f.collections) === null || _g === void 0 ? void 0 : _g.find((s) => s.name === subName);
            if (!subConfig) {
                return (_j = (_h = res).error) === null || _j === void 0 ? void 0 : _j.call(_h, { status: 404, errors: ['sub_collection_not_found'] });
            }
            // Check if action is allowed on this sub-collection
            if (!((_k = subConfig.actions) === null || _k === void 0 ? void 0 : _k.includes(actionName))) {
                return (_m = (_l = res).error) === null || _m === void 0 ? void 0 : _m.call(_l, { status: 400, errors: ['action_not_allowed'] });
            }
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, actionName));
            if (!hasAccess) {
                return (_p = (_o = res).error) === null || _p === void 0 ? void 0 : _p.call(_o, { status: 403, errors: ['forbidden'] });
            }
            const record = yield subConfig.model.findOne({
                where: {
                    id: subId,
                    [subConfig.foreignKey]: id
                }
            });
            if (!record) {
                return (_r = (_q = res).error) === null || _r === void 0 ? void 0 : _r.call(_q, { status: 404, errors: ['record_not_found'] });
            }
            const context = {
                collection,
                model: subConfig.model,
                parentId: id,
                subCollection: subName
            };
            const result = yield ((_s = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.actions) === null || _s === void 0 ? void 0 : _s.execute(actionName, record, formData, req, context));
            if (!(result === null || result === void 0 ? void 0 : result.success)) {
                return (_u = (_t = res).error) === null || _u === void 0 ? void 0 : _u.call(_t, { status: 400, errors: [(result === null || result === void 0 ? void 0 : result.error) || 'action_failed'] });
            }
            return (_w = (_v = res).success) === null || _w === void 0 ? void 0 : _w.call(_v, { status: 200, data: result.data });
        });
    }
    /**
     * POST /admin/collections/:collection/:id/actions
     * Execute an action on a record
     */
    executeAction(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
            const { collection: collectionName, id } = req.params;
            const _s = req.body, { action: actionName } = _s, formData = __rest(_s, ["action"]);
            const adminLeaf = getAdminLeaf();
            if (!actionName) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 400, errors: ['action_required'] });
            }
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 404, errors: ['collection_not_found'] });
            }
            if (!((_e = collection.actions) === null || _e === void 0 ? void 0 : _e.includes(actionName))) {
                return (_g = (_f = res).error) === null || _g === void 0 ? void 0 : _g.call(_f, { status: 400, errors: ['action_not_allowed'] });
            }
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, actionName));
            if (!hasAccess) {
                return (_j = (_h = res).error) === null || _j === void 0 ? void 0 : _j.call(_h, { status: 403, errors: ['forbidden'] });
            }
            const record = yield collection.model.findByPk(id);
            if (!record) {
                return (_l = (_k = res).error) === null || _l === void 0 ? void 0 : _l.call(_k, { status: 404, errors: ['record_not_found'] });
            }
            const context = {
                collection,
                model: collection.model
            };
            const result = yield ((_m = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.actions) === null || _m === void 0 ? void 0 : _m.execute(actionName, record, formData, req, context));
            if (!(result === null || result === void 0 ? void 0 : result.success)) {
                return (_p = (_o = res).error) === null || _p === void 0 ? void 0 : _p.call(_o, { status: 400, errors: [(result === null || result === void 0 ? void 0 : result.error) || 'action_failed'] });
            }
            return (_r = (_q = res).success) === null || _r === void 0 ? void 0 : _r.call(_q, { status: 200, data: result.data });
        });
    }
    /**
     * GET /admin/collections/:collection/search
     * Search/autocomplete endpoint for a collection
     */
    search(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            const { collection: collectionName } = req.params;
            const adminLeaf = getAdminLeaf();
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['collection_not_found'] });
            }
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, 'list'));
            if (!hasAccess) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 403, errors: ['forbidden'] });
            }
            try {
                const { q = '', fields: fieldsParam, limit = 20 } = req.query;
                const listView = (_e = collection.views) === null || _e === void 0 ? void 0 : _e.list;
                // Determine search fields
                const searchFields = fieldsParam
                    ? String(fieldsParam).split(',').map((f) => f.trim())
                    : ((listView === null || listView === void 0 ? void 0 : listView.search) || []);
                if (searchFields.length === 0 || !q) {
                    return (_g = (_f = res).success) === null || _g === void 0 ? void 0 : _g.call(_f, { status: 200, data: [] });
                }
                const where = {
                    [Op.or]: searchFields.map((field) => ({
                        [field]: { [Op.iLike]: `%${q}%` }
                    }))
                };
                const cappedLimit = Math.min(Number(limit), 50);
                const results = yield collection.model.findAll({
                    where,
                    attributes: ['id', ...searchFields],
                    limit: cappedLimit,
                    order: [['id', 'ASC']]
                });
                const items = results.map((r) => {
                    const json = r.toJSON ? r.toJSON() : Object.assign({}, r);
                    return json;
                });
                return (_j = (_h = res).success) === null || _j === void 0 ? void 0 : _j.call(_h, { status: 200, data: items });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] Search error for ${collectionName}:`, err);
                return (_l = (_k = res).error) === null || _l === void 0 ? void 0 : _l.call(_k, { status: 400, errors: [err.message] });
            }
        });
    }
    /**
     * GET /admin/collections/:collection/export
     * Export collection data as CSV or JSON
     */
    export(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            const { collection: collectionName } = req.params;
            const adminLeaf = getAdminLeaf();
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['collection_not_found'] });
            }
            if (!collection.exportable) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 403, errors: ['export_not_enabled'] });
            }
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, 'list'));
            if (!hasAccess) {
                return (_f = (_e = res).error) === null || _f === void 0 ? void 0 : _f.call(_e, { status: 403, errors: ['forbidden'] });
            }
            try {
                const _k = req.query, { format = 'csv', fields: fieldsParam, search } = _k, filters = __rest(_k, ["format", "fields", "search"]);
                const listView = (_g = collection.views) === null || _g === void 0 ? void 0 : _g.list;
                // Build where clause (reuse advanced filters)
                const allowedFilters = (listView === null || listView === void 0 ? void 0 : listView.filters) || [];
                const where = parseAdvancedFilters(filters, allowedFilters);
                // Build search clause
                if (search && (listView === null || listView === void 0 ? void 0 : listView.search) && listView.search.length > 0) {
                    where[Op.or] = listView.search.map((field) => ({
                        [field]: { [Op.iLike]: `%${search}%` }
                    }));
                }
                // Determine fields to export (exclude secure fields)
                const secureFieldNames = new Set((collection.fields || []).filter(f => f.secure).map(f => f.name));
                let exportFields;
                if (fieldsParam) {
                    exportFields = String(fieldsParam).split(',')
                        .map(f => f.trim())
                        .filter(f => !secureFieldNames.has(f));
                }
                else {
                    exportFields = (collection.fields || [])
                        .filter(f => !f.secure && f.type !== 'hasMany' && f.type !== 'belongsToMany')
                        .map(f => f.name);
                }
                const MAX_EXPORT_ROWS = 10000;
                const rows = yield collection.model.findAll({
                    where,
                    attributes: exportFields,
                    limit: MAX_EXPORT_ROWS,
                    order: [['id', 'ASC']],
                    raw: true
                });
                if (format === 'json') {
                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('Content-Disposition', `attachment; filename="${collectionName}_export.json"`);
                    return res.send(JSON.stringify(rows, null, 2));
                }
                // CSV format
                if (!exportFields || exportFields.length === 0) {
                    exportFields = rows.length > 0 ? Object.keys(rows[0]) : [];
                }
                const csvLines = [];
                csvLines.push(exportFields.map(escapeCsvValue).join(','));
                for (const row of rows) {
                    csvLines.push(exportFields.map(field => escapeCsvValue(row[field])).join(','));
                }
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${collectionName}_export.csv"`);
                return res.send(csvLines.join('\n'));
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] Export error for ${collectionName}:`, err);
                return (_j = (_h = res).error) === null || _j === void 0 ? void 0 : _j.call(_h, { status: 400, errors: [err.message] });
            }
        });
    }
    /**
     * POST /admin/collections/:collection/bulk
     * Bulk operations on collection records
     */
    bulk(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
            const { collection: collectionName } = req.params;
            const adminLeaf = getAdminLeaf();
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['collection_not_found'] });
            }
            const { action, ids, data } = req.body;
            if (!action || !ids || !Array.isArray(ids)) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 400, errors: ['action_and_ids_required'] });
            }
            if (ids.length > 100) {
                return (_f = (_e = res).error) === null || _f === void 0 ? void 0 : _f.call(_e, { status: 400, errors: ['max_100_ids_per_request'] });
            }
            // Check appropriate access
            const requiredAccess = action === 'delete' ? 'delete' : 'update';
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, requiredAccess));
            if (!hasAccess) {
                return (_h = (_g = res).error) === null || _h === void 0 ? void 0 : _h.call(_g, { status: 403, errors: ['forbidden'] });
            }
            try {
                const resolvedHooks = adminLeaf.getResolvedHooks(collectionName);
                if (action === 'delete') {
                    // If hooks are defined, run them per-record
                    if ((resolvedHooks === null || resolvedHooks === void 0 ? void 0 : resolvedHooks.beforeDelete) || (resolvedHooks === null || resolvedHooks === void 0 ? void 0 : resolvedHooks.afterDelete)) {
                        const records = yield collection.model.findAll({ where: { id: { [Op.in]: ids } } });
                        let deleted = 0;
                        for (const record of records) {
                            if (resolvedHooks === null || resolvedHooks === void 0 ? void 0 : resolvedHooks.beforeDelete) {
                                const canDelete = yield resolvedHooks.beforeDelete(record, req);
                                if (canDelete === false)
                                    continue;
                            }
                            yield record.destroy();
                            if (resolvedHooks === null || resolvedHooks === void 0 ? void 0 : resolvedHooks.afterDelete) {
                                yield resolvedHooks.afterDelete(record, req);
                            }
                            deleted++;
                        }
                        return (_k = (_j = res).success) === null || _k === void 0 ? void 0 : _k.call(_j, { status: 200, data: { deleted } });
                    }
                    else {
                        const deleted = yield collection.model.destroy({ where: { id: { [Op.in]: ids } } });
                        return (_m = (_l = res).success) === null || _m === void 0 ? void 0 : _m.call(_l, { status: 200, data: { deleted } });
                    }
                }
                if (action === 'update') {
                    if (!data || typeof data !== 'object') {
                        return (_p = (_o = res).error) === null || _p === void 0 ? void 0 : _p.call(_o, { status: 400, errors: ['data_required_for_update'] });
                    }
                    const [updated] = yield collection.model.update(data, { where: { id: { [Op.in]: ids } } });
                    return (_r = (_q = res).success) === null || _r === void 0 ? void 0 : _r.call(_q, { status: 200, data: { updated } });
                }
                return (_t = (_s = res).error) === null || _t === void 0 ? void 0 : _t.call(_s, { status: 400, errors: ['invalid_action'] });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] Bulk error for ${collectionName}:`, err);
                return (_v = (_u = res).error) === null || _v === void 0 ? void 0 : _v.call(_u, { status: 400, errors: [err.message] });
            }
        });
    }
    /**
     * POST /admin/collections/:collection/:id/duplicate
     * Duplicate a record
     */
    duplicate(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            const { collection: collectionName, id } = req.params;
            const adminLeaf = getAdminLeaf();
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['collection_not_found'] });
            }
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, 'create'));
            if (!hasAccess) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 403, errors: ['forbidden'] });
            }
            try {
                const record = yield collection.model.findByPk(id);
                if (!record) {
                    return (_f = (_e = res).error) === null || _f === void 0 ? void 0 : _f.call(_e, { status: 404, errors: ['not_found'] });
                }
                const data = record.toJSON ? record.toJSON() : Object.assign({}, record);
                // Strip auto-generated fields
                delete data.id;
                delete data.created_at;
                delete data.updated_at;
                delete data.deleted_at;
                delete data.createdAt;
                delete data.updatedAt;
                delete data.deletedAt;
                const newRecord = yield collection.model.create(data);
                return (_h = (_g = res).success) === null || _h === void 0 ? void 0 : _h.call(_g, { status: 201, data: newRecord });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] Duplicate error for ${collectionName}:`, err);
                return (_k = (_j = res).error) === null || _k === void 0 ? void 0 : _k.call(_j, { status: 400, errors: [err.message] });
            }
        });
    }
    /**
     * POST /admin/collections/:collection/:id/restore
     * Restore a soft-deleted record
     */
    restore(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
            const { collection: collectionName, id } = req.params;
            const adminLeaf = getAdminLeaf();
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['collection_not_found'] });
            }
            if (!((_c = collection.softDelete) === null || _c === void 0 ? void 0 : _c.enabled)) {
                return (_e = (_d = res).error) === null || _e === void 0 ? void 0 : _e.call(_d, { status: 400, errors: ['soft_delete_not_enabled'] });
            }
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, 'update'));
            if (!hasAccess) {
                return (_g = (_f = res).error) === null || _g === void 0 ? void 0 : _g.call(_f, { status: 403, errors: ['forbidden'] });
            }
            try {
                const record = yield collection.model.findByPk(id, { paranoid: false });
                if (!record) {
                    return (_j = (_h = res).error) === null || _j === void 0 ? void 0 : _j.call(_h, { status: 404, errors: ['not_found'] });
                }
                if (typeof record.restore !== 'function') {
                    return (_l = (_k = res).error) === null || _l === void 0 ? void 0 : _l.call(_k, { status: 400, errors: ['model_does_not_support_restore'] });
                }
                yield record.restore();
                return (_o = (_m = res).success) === null || _o === void 0 ? void 0 : _o.call(_m, { status: 200, data: record });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] Restore error for ${collectionName}:`, err);
                return (_q = (_p = res).error) === null || _q === void 0 ? void 0 : _q.call(_p, { status: 400, errors: [err.message] });
            }
        });
    }
    /**
     * GET /admin/collections/:collection/stats
     * Get stats for a collection
     *
     * Query params:
     * - stat: stat name (optional, returns all if not specified)
     * - from: start date ISO string (optional)
     * - to: end date ISO string (optional)
     * - granularity: 'day' | 'week' | 'month' (default: 'day', for timeline stats)
     */
    stats(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            const { collection: collectionName } = req.params;
            const { stat: statName, from, to, granularity = 'day' } = req.query;
            const adminLeaf = getAdminLeaf();
            const collection = adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.getCollection(collectionName);
            if (!collection) {
                return (_b = (_a = res).error) === null || _b === void 0 ? void 0 : _b.call(_a, { status: 404, errors: ['collection_not_found'] });
            }
            const hasAccess = yield (adminLeaf === null || adminLeaf === void 0 ? void 0 : adminLeaf.checkAccess(req.user, collectionName, 'list'));
            if (!hasAccess) {
                return (_d = (_c = res).error) === null || _d === void 0 ? void 0 : _d.call(_c, { status: 403, errors: ['forbidden'] });
            }
            const collectionStats = collection.stats || [];
            if (collectionStats.length === 0) {
                return (_f = (_e = res).success) === null || _f === void 0 ? void 0 : _f.call(_e, { status: 200, data: { stats: [] } });
            }
            // Filter to specific stat if requested
            const statsToProcess = statName
                ? collectionStats.filter(s => s.name === statName)
                : collectionStats;
            try {
                const results = {};
                for (const stat of statsToProcess) {
                    results[stat.name] = yield this.computeStat(collection.model, stat, { from, to, granularity });
                }
                return (_h = (_g = res).success) === null || _h === void 0 ? void 0 : _h.call(_g, { status: 200, data: { stats: results } });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] Stats error for ${collectionName}:`, err);
                return (_k = (_j = res).error) === null || _k === void 0 ? void 0 : _k.call(_j, { status: 400, errors: [err.message] });
            }
        });
    }
    /**
     * Compute a single stat
     */
    computeStat(model, stat, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { from, to, granularity = 'day' } = options;
            const dateField = stat.dateField || 'created_at';
            // Build where conditions
            const where = {};
            // Add stat-specific conditions
            if (stat.where) {
                for (const [key, value] of Object.entries(stat.where)) {
                    if (value === '$not_null$') {
                        where[key] = { [Op.ne]: null };
                    }
                    else if (value === '$null$') {
                        where[key] = null;
                    }
                    else {
                        where[key] = value;
                    }
                }
            }
            // Add date range filter (unless stat is global)
            if ((from || to) && !stat.global) {
                where[dateField] = {};
                if (from)
                    where[dateField][Op.gte] = new Date(from);
                if (to)
                    where[dateField][Op.lte] = new Date(to);
            }
            if (stat.type === 'count') {
                // Simple count
                const count = yield model.count({ where });
                return {
                    type: 'count',
                    label: stat.label,
                    icon: stat.icon,
                    color: stat.color,
                    value: count,
                    global: (_a = stat.global) !== null && _a !== void 0 ? _a : false
                };
            }
            if (stat.type === 'timeline') {
                // Count grouped by date (PostgreSQL format)
                const dateFormat = granularity === 'month'
                    ? 'YYYY-MM'
                    : granularity === 'week'
                        ? 'IYYY-IW' // ISO week
                        : 'YYYY-MM-DD';
                const results = yield model.findAll({
                    attributes: [
                        [fn('TO_CHAR', col(dateField), dateFormat), 'date'],
                        [fn('COUNT', col('id')), 'count']
                    ],
                    where,
                    group: [fn('TO_CHAR', col(dateField), dateFormat)],
                    order: [[fn('TO_CHAR', col(dateField), dateFormat), 'ASC']],
                    raw: true
                });
                return {
                    type: 'timeline',
                    label: stat.label,
                    icon: stat.icon,
                    color: stat.color,
                    granularity,
                    data: results.map((r) => ({
                        date: r.date,
                        count: parseInt(r.count, 10)
                    }))
                };
            }
            return null;
        });
    }
};
__decorate([
    Get('/admin/collections/:collection'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "list", null);
__decorate([
    Get('/admin/collections/:collection/:id(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "show", null);
__decorate([
    Get('/admin/collections/:collection/:id(\\d+)/collections/:subName'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "subCollection", null);
__decorate([
    Post('/admin/collections/:collection'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "create", null);
__decorate([
    Put('/admin/collections/:collection/:id(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "update", null);
__decorate([
    Delete('/admin/collections/:collection/:id(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "delete", null);
__decorate([
    Get('/admin/collections/:collection/:id(\\d+)/collections/:subName/:subId(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "showSubCollectionItem", null);
__decorate([
    Put('/admin/collections/:collection/:id(\\d+)/collections/:subName/:subId(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "updateSubCollectionItem", null);
__decorate([
    Delete('/admin/collections/:collection/:id(\\d+)/collections/:subName/:subId(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "deleteSubCollectionItem", null);
__decorate([
    Post('/admin/collections/:collection/:id(\\d+)/collections/:subName/:subId(\\d+)/actions'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "executeSubCollectionAction", null);
__decorate([
    Post('/admin/collections/:collection/:id(\\d+)/actions'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "executeAction", null);
__decorate([
    Get('/admin/collections/:collection/search'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "search", null);
__decorate([
    Get('/admin/collections/:collection/export'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "export", null);
__decorate([
    Post('/admin/collections/:collection/bulk'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "bulk", null);
__decorate([
    Post('/admin/collections/:collection/:id(\\d+)/duplicate'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "duplicate", null);
__decorate([
    Post('/admin/collections/:collection/:id(\\d+)/restore'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "restore", null);
__decorate([
    Get('/admin/collections/:collection/stats'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AdminCollectionsController.prototype, "stats", null);
AdminCollectionsController = __decorate([
    Controller()
], AdminCollectionsController);
export default AdminCollectionsController;
export const AvailableRouteMethods = [
    'list',
    'search',
    'export',
    'bulk',
    'show',
    'subCollection',
    'showSubCollectionItem',
    'updateSubCollectionItem',
    'deleteSubCollectionItem',
    'executeSubCollectionAction',
    'create',
    'update',
    'delete',
    'duplicate',
    'restore',
    'executeAction',
    'stats'
];
