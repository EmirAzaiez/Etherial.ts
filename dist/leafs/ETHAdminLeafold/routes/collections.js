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
 * Process belongsToMany relations after parent record is created/updated
 * Syncs the junction table with the provided IDs
 */
function processBelongsToManyItems(record, fieldName, _config, // For future pivot fields support
itemIds) {
    return __awaiter(this, void 0, void 0, function* () {
        const stats = { added: 0, removed: 0 };
        if (!itemIds || !Array.isArray(itemIds)) {
            return stats;
        }
        try {
            // Use Sequelize's set method for the association
            // This automatically handles the junction table
            const setMethodName = `set${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`;
            if (typeof record[setMethodName] === 'function') {
                // Get current associations to calculate stats
                const getMethodName = `get${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`;
                const currentItems = typeof record[getMethodName] === 'function'
                    ? yield record[getMethodName]()
                    : [];
                const currentIds = new Set(currentItems.map((item) => item.id));
                // Set new associations
                yield record[setMethodName](itemIds);
                // Calculate stats
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
    }
    // If no transformations needed, return items as-is
    if (Object.keys(optionsMap).length === 0 && secureFields.size === 0) {
        return items;
    }
    // Transform each item
    return items.map(item => {
        const json = item.toJSON ? item.toJSON() : Object.assign({}, item);
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
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
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
                const _k = req.query, { limit = 25, offset = 0, sort, order, search } = _k, filters = __rest(_k, ["limit", "offset", "sort", "order", "search"]);
                const listView = (_e = collection.views) === null || _e === void 0 ? void 0 : _e.list;
                // Build where clause from filters
                const where = {};
                const allowedFilters = (listView === null || listView === void 0 ? void 0 : listView.filters) || [];
                for (const [key, value] of Object.entries(filters)) {
                    if (allowedFilters.includes(key) && value !== undefined && value !== '') {
                        where[key] = value;
                    }
                }
                // Build search clause
                if (search && (listView === null || listView === void 0 ? void 0 : listView.search) && listView.search.length > 0) {
                    const { Op } = require('sequelize');
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
                const result = yield collection.model.findAndCountAll({
                    where,
                    attributes: listView === null || listView === void 0 ? void 0 : listView.fields,
                    include: (listView === null || listView === void 0 ? void 0 : listView.include) || [],
                    order: orderClause,
                    limit: Number(limit),
                    offset: Number(offset)
                });
                // Transform field values for admin display (enums, secure fields)
                const transformedItems = transformFields(result.rows, collection.fields || []);
                // Add CDN URLs to all media objects
                const itemsWithUrls = transformMediaUrls(transformedItems);
                return (_g = (_f = res).success) === null || _g === void 0 ? void 0 : _g.call(_f, {
                    status: 200,
                    data: { items: itemsWithUrls, total: result.count }
                });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] List error for ${collectionName}:`, err);
                return (_j = (_h = res).error) === null || _j === void 0 ? void 0 : _j.call(_h, { status: 400, errors: [err.message] });
            }
        });
    }
    /**
     * GET /admin/collections/:collection/:id
     * Show a single record
     */
    show(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            const { collection: collectionName, id } = req.params;
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
                // Transform field values for admin display (enums, secure fields)
                const [transformedRecord] = transformFields([record], collection.fields || []);
                // Add CDN URLs to all media objects
                const recordWithUrls = transformMediaUrls(transformedRecord);
                return (_j = (_h = res).success) === null || _j === void 0 ? void 0 : _j.call(_h, { status: 200, data: recordWithUrls });
            }
            catch (err) {
                console.error(`[ETHAdminLeaf] Show error for ${collectionName}:`, err);
                return (_l = (_k = res).error) === null || _l === void 0 ? void 0 : _l.call(_k, { status: 400, errors: [err.message] });
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
                const items = yield subConfig.model.findAndCountAll({
                    where: { [subConfig.foreignKey]: id },
                    include: nestedIncludes,
                    order,
                    limit: Number(limit),
                    offset: Number(offset)
                });
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
    'show',
    'subCollection',
    'showSubCollectionItem',
    'updateSubCollectionItem',
    'deleteSubCollectionItem',
    'executeSubCollectionAction',
    'create',
    'update',
    'delete',
    'executeAction',
    'stats'
];
