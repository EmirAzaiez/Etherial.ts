import etherial from 'etherial'

import { coverOf } from './blocks.js'
import type { PageImage } from './options.js'

// ──────────────────────────────────────────────────────────────────────────
// The photo across the top of a page: its record's cover (a news' image), a
// media of the media leaf. The page keeps its address, so that drawing it
// never reads the media table.
// ──────────────────────────────────────────────────────────────────────────

/** Its address on the web, when its folder is public-read; null otherwise. */
async function mediaCover(id: number): Promise<PageImage | null> {
    const Media = (etherial as any).database?.sequelize?.models?.Media
    const leaf = (etherial as any).eth_media_leaf
    if (!Media || !leaf?.getPublicUrl) return null
    const media = await Media.findByPk(id).catch(() => null)
    const src = media ? leaf.getPublicUrl(media) : null
    return src ? { src, media: id } : null
}

/**
 * A cover as a record or the back-office gives it: a media's id, a media,
 * an address, `{ src | url }`. Null when there is none, or none to show.
 */
export async function coverFrom(value: unknown): Promise<PageImage | null> {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
        const id = Number(value)
        return Number.isInteger(id) && id > 0 ? mediaCover(id) : null
    }
    if (typeof value === 'string') return coverOf({ src: value })
    if (typeof value !== 'object') return null
    const v = value as Record<string, any>
    if (typeof v.src === 'string' || typeof v.url === 'string') return coverOf({ src: v.src ?? v.url, media: v.media ?? v.id })
    return typeof v.id === 'number' ? mediaCover(v.id) : null
}
