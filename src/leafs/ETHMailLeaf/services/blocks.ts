import { Align, BLOCK_TYPES, LocalBlock, MailBlock, MailError, localize } from './options.js'

// ──────────────────────────────────────────────────────────────────────────
// Blocks: picking a language out of the project's ones, and checking the ones
// the back-office sends before they are saved or rendered.
// ──────────────────────────────────────────────────────────────────────────

const MAX_BLOCKS = 60
const MAX_TEXT = 5000
const MAX_URL = 2000
const MAX_ROWS = 30
const ALIGNS: Align[] = ['start', 'center', 'end']

/** The project's blocks with every text in `locale`. */
export function localizeBlocks(blocks: MailBlock[], locale: string, fallback: string): LocalBlock[] {
    const t = (text: any) => localize(text, locale, fallback)
    return blocks.map((block): LocalBlock => {
        switch (block.type) {
            case 'heading':
            case 'text':
            case 'note':
                return { ...block, text: t(block.text) } as LocalBlock
            case 'button':
                return { ...block, label: t(block.label) }
            case 'code':
                return { ...block, label: block.label === undefined ? undefined : t(block.label) }
            case 'image':
                return { ...block, alt: block.alt === undefined ? undefined : t(block.alt) }
            case 'details':
                return { ...block, rows: block.rows.map((row) => ({ label: t(row.label), value: t(row.value) })) }
            default:
                return { ...block }
        }
    })
}

function text(value: unknown, field: string, max = MAX_TEXT, required = true): string {
    if (value === undefined || value === null || value === '') {
        if (required) throw new MailError('invalid_block', 400, `${field} is empty`)
        return ''
    }
    if (typeof value !== 'string' && typeof value !== 'number') throw new MailError('invalid_block', 400, `${field} must be a text`)
    const out = String(value)
    if (out.length > max) throw new MailError('invalid_block', 400, `${field} is too long`)
    return out
}

/** A link written in full, or a `{{variable}}` the code fills in. */
function url(value: unknown, field: string): string {
    const out = text(value, field, MAX_URL).trim()
    if (/^(https?:\/\/|mailto:|tel:|\{\{)/i.test(out)) return out
    throw new MailError('invalid_url', 400, `${field} must start with https://, mailto:, tel: or a {{variable}}`)
}

function align(value: unknown): Align | undefined {
    return ALIGNS.includes(value as Align) ? (value as Align) : undefined
}

/** Blocks as the back-office sent them, checked: anything unknown is refused, not dropped. */
export function normalizeBlocks(input: unknown): LocalBlock[] {
    if (!Array.isArray(input)) throw new MailError('invalid_blocks', 400, 'blocks must be a list')
    if (input.length > MAX_BLOCKS) throw new MailError('invalid_blocks', 400, `${MAX_BLOCKS} blocks at most`)
    return input.map((raw: any, i): LocalBlock => {
        const at = `Block ${i + 1}`
        if (!raw || typeof raw !== 'object' || !BLOCK_TYPES.includes(raw.type)) throw new MailError('invalid_block', 400, `${at}: unknown type`)
        switch (raw.type as LocalBlock['type']) {
            case 'heading':
                return { type: 'heading', text: text(raw.text, at, 300), align: align(raw.align) }
            case 'text':
                return { type: 'text', text: text(raw.text, at), align: align(raw.align), muted: raw.muted === true || undefined }
            case 'button':
                return {
                    type: 'button',
                    label: text(raw.label, at, 120),
                    url: url(raw.url, at),
                    align: align(raw.align),
                    style: raw.style === 'outline' ? 'outline' : undefined,
                }
            case 'code':
                return { type: 'code', value: text(raw.value, at, 120), label: text(raw.label, at, 300, false) || undefined }
            case 'image': {
                const width = Number(raw.width)
                return {
                    type: 'image',
                    src: url(raw.src, at),
                    alt: text(raw.alt, at, 300, false) || undefined,
                    width: Number.isFinite(width) && width > 0 ? Math.min(600, Math.max(24, Math.round(width))) : undefined,
                    url: raw.url ? url(raw.url, at) : undefined,
                    align: align(raw.align),
                }
            }
            case 'note':
                return { type: 'note', text: text(raw.text, at), tone: raw.tone === 'warning' ? 'warning' : undefined }
            case 'details': {
                if (!Array.isArray(raw.rows) || !raw.rows.length) throw new MailError('invalid_block', 400, `${at}: add a line`)
                if (raw.rows.length > MAX_ROWS) throw new MailError('invalid_block', 400, `${at}: ${MAX_ROWS} lines at most`)
                return { type: 'details', rows: raw.rows.map((row: any) => ({ label: text(row?.label, at, 300), value: text(row?.value, at, 1000) })) }
            }
            case 'divider':
                return { type: 'divider' }
            case 'spacer':
                return { type: 'spacer', size: raw.size === 'sm' || raw.size === 'lg' ? raw.size : undefined }
        }
    })
}

/** The subject or preheader as the back-office sent it. */
export function normalizeLine(value: unknown, field: string, required: boolean): string {
    if (value === undefined || value === null || String(value).trim() === '') {
        if (required) throw new MailError('invalid_' + field, 400, `The ${field} is empty`)
        return ''
    }
    const out = String(value).replace(/\s+/g, ' ').trim()
    if (out.length > 300) throw new MailError('invalid_' + field, 400, `The ${field} is too long`)
    return out
}

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*(?:\|([^{}|]*))?\}\}/g

/** Every `{{variable}}` a version of an email uses. */
export function placeholdersOf(parts: { subject: string; preheader?: string; blocks: LocalBlock[] }): string[] {
    const found = new Set<string>()
    const scan = (value: unknown) => {
        if (typeof value !== 'string') return
        for (const match of value.matchAll(PLACEHOLDER)) found.add(match[1])
    }
    scan(parts.subject)
    scan(parts.preheader)
    for (const block of parts.blocks) {
        for (const value of Object.values(block)) {
            if (Array.isArray(value)) value.forEach((row) => Object.values(row).forEach(scan))
            else scan(value)
        }
    }
    return [...found]
}
