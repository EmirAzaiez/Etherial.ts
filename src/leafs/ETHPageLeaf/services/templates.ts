import { PageTemplate } from '../models/PageTemplate.js'
import { normalizePageBlocks } from './blocks.js'
import { PageBlocks, PageError, localesOf } from './options.js'
import { state } from './state.js'

// ──────────────────────────────────────────────────────────────────────────
// Templates: blocks saved from the editor to start another page from. Any
// back-office user may save, use and delete them, like the preview: they are
// only blocks, read as drafts.
// ──────────────────────────────────────────────────────────────────────────

export interface TemplateOut {
    id: number
    name: string
    blocks: PageBlocks
    created_at: Date
    updated_at: Date
}

function out(template: PageTemplate): TemplateOut {
    // Read again as drafts: the blocks of an older template follow today's rules.
    return {
        id: template.id,
        name: template.name,
        blocks: normalizePageBlocks(template.blocks, localesOf(state.config), 'draft'),
        created_at: template.created_at,
        updated_at: template.updated_at,
    }
}

// The same checks for a new template and an edited one.
function nameOf(value: unknown): string {
    const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
    if (!name) throw new PageError('Give the template a name.')
    if (name.length > 120) throw new PageError('The name is 120 characters at most.')
    return name
}

function blocksOf(value: unknown): PageBlocks {
    const blocks = normalizePageBlocks(value, localesOf(state.config), 'draft')
    if (!Object.values(blocks).some((list) => list.length)) throw new PageError('Add at least one block to the template.')
    return blocks
}

async function find(id: string | number): Promise<PageTemplate> {
    const template = await PageTemplate.findByPk(Number(id))
    if (!template) throw new PageError('Not found.', 404)
    return template
}

/** Every template, the newest first. */
export async function listTemplates(): Promise<TemplateOut[]> {
    const templates = await PageTemplate.findAll({ order: [['created_at', 'DESC'], ['id', 'DESC']] })
    return templates.map(out)
}

export async function createTemplate(body: Record<string, any>): Promise<TemplateOut> {
    return out(await PageTemplate.create({ name: nameOf(body.name), blocks: blocksOf(body.blocks) } as any))
}

/** Renamed, or its blocks rewritten: only what the body gives changes. */
export async function updateTemplate(id: string | number, body: Record<string, any>): Promise<TemplateOut> {
    const template = await find(id)
    const changes: Partial<Pick<PageTemplate, 'name' | 'blocks'>> = {}
    if (body.name !== undefined) changes.name = nameOf(body.name)
    if (body.blocks !== undefined) changes.blocks = blocksOf(body.blocks)
    if (Object.keys(changes).length) await template.update(changes)
    return out(template)
}

export async function deleteTemplate(id: string | number): Promise<{ id: number }> {
    const template = await find(id)
    await template.destroy()
    return { id: template.id }
}
