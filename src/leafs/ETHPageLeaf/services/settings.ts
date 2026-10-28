import { createHash } from 'crypto'

import { PageSettings } from '../models/PageSettings.js'
import { normalizeHead } from './blocks.js'
import { PageFonts, fontIdOf } from './fonts.js'
import { DEFAULT_HEAD, PageHead } from './options.js'
import { state } from './state.js'

// ──────────────────────────────────────────────────────────────────────────
// The settings of every page, from the back-office: their fonts, how they
// open. Kept in memory, read again from the database after half a minute, so
// that drawing a page (for the app, for the web) never waits for it.
// ──────────────────────────────────────────────────────────────────────────

const ID = 1
const FRESH = 30_000
/** Changed when the HTML is drawn differently: every published page is written again at the next boot. */
const DRAWING = 2

let saved: PageFonts = {}
let savedHead: PageHead = {}
let readAt = 0

/** How every page opens: no page's own photo in it. */
function lookOf(head: PageHead | null | undefined): PageHead {
    const look = { ...(head ?? {}) }
    delete look.photo
    return look
}
let reading: Promise<void> | null = null

function clean(fonts: unknown): PageFonts {
    const f = (fonts && typeof fonts === 'object' ? fonts : {}) as Record<string, unknown>
    const out: PageFonts = {}
    const title = fontIdOf(f.title)
    const text = fontIdOf(f.text)
    if (title) out.title = title
    if (text) out.text = text
    return out
}

/** Reads the row again; a database that fails keeps what was read before. */
export function loadSettings(): Promise<void> {
    reading ??= PageSettings.findByPk(ID)
        .then((row) => {
            saved = clean(row?.fonts)
            savedHead = lookOf(normalizeHead(row?.head))
            readAt = Date.now()
        })
        .catch((err) => console.error('[ETHPageLeaf] Could not read the pages settings:', err?.message ?? err))
        .finally(() => {
            reading = null
        })
    return reading
}

function fresh() {
    if (Date.now() - readAt > FRESH) void loadSettings()
}

/** The fonts the pages are drawn in now: the back-office's, else the theme's. */
export function pageFonts(): PageFonts {
    fresh()
    const theme = state.config.theme?.fonts ?? {}
    return clean({ title: saved.title ?? theme.title, text: saved.text ?? theme.text })
}

/** How a page opens when it sets nothing: the theme's look, under it `DEFAULT_HEAD`. */
export function themeHead(): PageHead {
    return { ...DEFAULT_HEAD, ...lookOf(normalizeHead(state.config.theme?.head)) }
}

/**
 * How a page opens: its own choices, over every page's (`look`, else the
 * back-office's), over the theme's. `look` is the one the settings are
 * trying out, not saved yet. The page's own photo isn't in it: it is the
 * page's cover (`photoOf`).
 */
export function pageHead(own?: PageHead | null, look?: PageHead | null): PageHead {
    fresh()
    return lookOf({ ...themeHead(), ...(look === undefined ? savedHead : lookOf(look)), ...(own ?? {}) })
}

export interface SettingsOut {
    /** What the back-office picked: null is the theme's. */
    fonts: { title: string | null; text: string | null }
    /** How every page opens, as the back-office set it: a key left out is the theme's. */
    head: PageHead
}

function out(): SettingsOut {
    return { fonts: { title: saved.title ?? null, text: saved.text ?? null }, head: savedHead }
}

export async function readSettings(): Promise<SettingsOut> {
    await loadSettings()
    return out()
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {})

/**
 * `{ fonts: { title?, text? }, head? }`: a font given replaces the one set,
 * null goes back to the theme's; a head replaces every page's look, null
 * goes back to the theme's. `changed`: the pages' HTML has to be written again.
 */
export async function saveSettings(body: Record<string, any>): Promise<{ settings: SettingsOut; changed: boolean }> {
    await loadSettings()
    const given = body.fonts && typeof body.fonts === 'object' ? body.fonts : {}
    const next: PageFonts = { ...saved }
    for (const role of ['title', 'text'] as const) {
        if (!(role in given)) continue
        const id = fontIdOf(given[role])
        if (id) next[role] = id
        else delete next[role]
    }
    const head = 'head' in body ? lookOf(normalizeHead(body.head)) : savedHead
    const changed = next.title !== saved.title || next.text !== saved.text || !same(head, savedHead)
    if (changed) {
        const [row] = await PageSettings.findOrCreate({ where: { id: ID }, defaults: { id: ID, fonts: {} } as any })
        await row.update({ fonts: next, head: Object.keys(head).length ? head : null })
        saved = next
        savedHead = head
        readAt = Date.now()
    }
    return { settings: out(), changed }
}

/**
 * True once after the theme (or the way pages are drawn) changed since the
 * HTML was last written: the boot then writes every page again.
 */
export async function lookChanged(): Promise<boolean> {
    const look = createHash('sha256')
        .update(JSON.stringify({ drawing: DRAWING, theme: state.config.theme ?? {} }))
        .digest('hex')
        .slice(0, 32)
    const [row] = await PageSettings.findOrCreate({ where: { id: ID }, defaults: { id: ID, fonts: {} } as any })
    if (row.look === look) return false
    await row.update({ look })
    return true
}
