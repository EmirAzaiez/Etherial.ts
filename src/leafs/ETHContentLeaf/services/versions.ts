import { AppRelease } from '../models/AppRelease.js'
import { PLATFORMS, Platform, compareVersions, localize, parseVersion } from './options.js'
import { languages, state } from './state.js'

/**
 * What the app at a version does:
 * - `none`: it is the latest, or no version is listed;
 * - `available`: a newer minor version is out, nothing to ask;
 * - `banner`: a banner asks to update from the store; it can be closed;
 * - `required`: the app is blocked until it is updated.
 */
export type UpdateKind = 'none' | 'available' | 'banner' | 'required'

export interface AppUpdate {
    platform: Platform
    /** The app's version, as it gave it. Null without one: `update` is then null too. */
    version: string | null
    /** The newest published version. */
    latest: string | null
    /** The newest required version: an app below it is blocked. */
    minimum: string | null
    update: UpdateKind | null
    store_url: string | null
    /** The banner's or the block's texts, in the app's language: the team's, else the leaf's. */
    title: string | null
    message: string | null
}

/** The leaf's texts, when the team wrote none. */
const TEXTS: Record<string, Record<'update' | 'required', { title: string; message: string }>> = {
    en: {
        update: { title: 'A new version is available', message: 'Update the app to get the latest features.' },
        required: { title: 'Update required', message: 'This version of the app is no longer supported. Update it to keep using it.' },
    },
    ar: {
        update: { title: 'يتوفر إصدار جديد', message: 'حدّث التطبيق للحصول على أحدث الميزات.' },
        required: { title: 'التحديث مطلوب', message: 'هذا الإصدار من التطبيق لم يعد مدعومًا. حدّثه لمتابعة استخدامه.' },
    },
    fr: {
        update: { title: 'Une nouvelle version est disponible', message: "Mettez l'application à jour pour profiter des dernières nouveautés." },
        required: { title: 'Mise à jour requise', message: "Cette version de l'application n'est plus prise en charge. Mettez-la à jour pour continuer." },
    },
}

export function platformOf(value: unknown): Platform | null {
    const platform = typeof value === 'string' ? value.trim().toLowerCase() : ''
    return (PLATFORMS as readonly string[]).includes(platform) ? (platform as Platform) : null
}

/** Whether an app at `version` asks for `release`: a required one blocks, a banner asks, `auto` asks for a new major version. */
function promptOf(release: AppRelease, version: string): UpdateKind {
    if (release.prompt === 'required') return 'required'
    if (release.prompt === 'banner') return 'banner'
    return (parseVersion(release.version)![0] ?? 0) > (parseVersion(version)![0] ?? 0) ? 'banner' : 'available'
}

const RANK: Record<UpdateKind, number> = { none: 0, available: 1, banner: 2, required: 3 }

/**
 * What the app at `version` on `platform` does, and what it shows, in
 * `locale`. Each newer published version has its say; the strongest wins,
 * and its texts with it (the newest of them).
 */
export async function appUpdateOf(platform: Platform, version: string | null | undefined, locale: string): Promise<AppUpdate> {
    const releases = (await AppRelease.findAll({ where: { platform, published: true } })).sort((a, b) => compareVersions(b.version, a.version))
    const store_url = state.config.stores?.[platform] || null
    const answer: AppUpdate = {
        platform,
        version: version ?? null,
        latest: releases[0]?.version ?? null,
        minimum: releases.find((r) => r.prompt === 'required')?.version ?? null,
        update: null,
        store_url,
        title: null,
        message: null,
    }
    if (!version || !parseVersion(version)) return answer

    const newer = releases.filter((r) => compareVersions(r.version, version) > 0).map((release) => ({ release, kind: promptOf(release, version) }))
    const update = newer.reduce<UpdateKind>((strongest, { kind }) => (RANK[kind] > RANK[strongest] ? kind : strongest), 'none')
    answer.update = update
    // A newer minor version shows nothing: no texts.
    if (update === 'none' || update === 'available') return answer

    // The newest of the versions that ask the same, among those the team wrote a text for.
    const speakers = newer.filter((n) => n.kind === update).map((n) => n.release)
    const leaf = TEXTS[locale]?.[update === 'required' ? 'required' : 'update']
    const textOf = (field: 'title' | 'message') => {
        const written = speakers.find((r) => Object.keys(r[field] ?? {}).length)?.[field]
        // In the app's language: the team's, else the leaf's, else the team's in another language.
        return written?.[locale] || leaf?.[field] || localize(written, locale, languages().default) || TEXTS.en[update === 'required' ? 'required' : 'update'][field]
    }
    answer.title = textOf('title')
    answer.message = textOf('message')
    return answer
}
