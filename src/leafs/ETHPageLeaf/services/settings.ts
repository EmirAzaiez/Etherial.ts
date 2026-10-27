import { PageSettings } from '../models/PageSettings.js'
import { PageFonts, fontIdOf } from './fonts.js'
import { state } from './state.js'

// ──────────────────────────────────────────────────────────────────────────
// The settings of every page, from the back-office: their fonts. Kept in
// memory, read again from the database after half a minute, so that drawing
// a page (for the app, for the web) never waits for it.
// ──────────────────────────────────────────────────────────────────────────

const ID = 1
const FRESH = 30_000

let saved: PageFonts = {}
let readAt = 0
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
            readAt = Date.now()
        })
        .catch((err) => console.error('[ETHPageLeaf] Could not read the pages settings:', err?.message ?? err))
        .finally(() => {
            reading = null
        })
    return reading
}

/** The fonts the pages are drawn in now: the back-office's, else the theme's. */
export function pageFonts(): PageFonts {
    if (Date.now() - readAt > FRESH) void loadSettings()
    const theme = state.config.theme?.fonts ?? {}
    return clean({ title: saved.title ?? theme.title, text: saved.text ?? theme.text })
}

export interface SettingsOut {
    /** What the back-office picked: null is the theme's. */
    fonts: { title: string | null; text: string | null }
}

function out(): SettingsOut {
    return { fonts: { title: saved.title ?? null, text: saved.text ?? null } }
}

export async function readSettings(): Promise<SettingsOut> {
    await loadSettings()
    return out()
}

/**
 * `{ fonts: { title?, text? } }`: a font given replaces the one set, null goes
 * back to the theme's. `changed`: the pages' HTML has to be written again.
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
    const changed = next.title !== saved.title || next.text !== saved.text
    if (changed) {
        const [row] = await PageSettings.findOrCreate({ where: { id: ID }, defaults: { id: ID, fonts: {} } as any })
        await row.update({ fonts: next })
        saved = next
        readAt = Date.now()
    }
    return { settings: out(), changed }
}
