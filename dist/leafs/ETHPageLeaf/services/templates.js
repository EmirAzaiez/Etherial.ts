var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { PageTemplate } from '../models/PageTemplate.js';
import { normalizePageBlocks } from './blocks.js';
import { PageError, localesOf } from './options.js';
import { state } from './state.js';
function out(template) {
    // Read again as drafts: the blocks of an older template follow today's rules.
    return {
        id: template.id,
        name: template.name,
        blocks: normalizePageBlocks(template.blocks, localesOf(state.config), 'draft'),
        created_at: template.created_at,
        updated_at: template.updated_at,
    };
}
// The same checks for a new template and an edited one.
function nameOf(value) {
    const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    if (!name)
        throw new PageError('Give the template a name.');
    if (name.length > 120)
        throw new PageError('The name is 120 characters at most.');
    return name;
}
function blocksOf(value) {
    const blocks = normalizePageBlocks(value, localesOf(state.config), 'draft');
    if (!Object.values(blocks).some((list) => list.length))
        throw new PageError('Add at least one block to the template.');
    return blocks;
}
function find(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const template = yield PageTemplate.findByPk(Number(id));
        if (!template)
            throw new PageError('Not found.', 404);
        return template;
    });
}
/** Every template, the newest first. */
export function listTemplates() {
    return __awaiter(this, void 0, void 0, function* () {
        const templates = yield PageTemplate.findAll({ order: [['created_at', 'DESC'], ['id', 'DESC']] });
        return templates.map(out);
    });
}
export function createTemplate(body) {
    return __awaiter(this, void 0, void 0, function* () {
        return out(yield PageTemplate.create({ name: nameOf(body.name), blocks: blocksOf(body.blocks) }));
    });
}
/** Renamed, or its blocks rewritten: only what the body gives changes. */
export function updateTemplate(id, body) {
    return __awaiter(this, void 0, void 0, function* () {
        const template = yield find(id);
        const changes = {};
        if (body.name !== undefined)
            changes.name = nameOf(body.name);
        if (body.blocks !== undefined)
            changes.blocks = blocksOf(body.blocks);
        if (Object.keys(changes).length)
            yield template.update(changes);
        return out(template);
    });
}
export function deleteTemplate(id) {
    return __awaiter(this, void 0, void 0, function* () {
        const template = yield find(id);
        yield template.destroy();
        return { id: template.id };
    });
}
