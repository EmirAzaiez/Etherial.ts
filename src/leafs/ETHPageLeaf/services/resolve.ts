import { CalendarTarget, calendarLinks } from './calendar.js'
import { BlockOf, ContactKind, PageBlock, ResolvedBlock, ResolvedExtras } from './options.js'

// ──────────────────────────────────────────────────────────────────────────
// What a block needs worked out before it is drawn, done once by the API in
// the page's language: an event's date as people read it and its "Add to
// calendar" link, a video's player, a contact's link. The app and the web
// get the same words, and the phone computes nothing.
// ──────────────────────────────────────────────────────────────────────────

export interface ResolveOptions {
    /** The page's language: the dates and the default words are in it. */
    locale: string
    /** The page's title: an event without its own title is put in the calendar under it. */
    title?: string
    /** The project's (`Asia/Dubai`): an event's times are in it. */
    timezone?: string
}

/** Bare `en` reads dates the American way ("November 14"); the pages are written for the rest of the world. */
function intlLocale(locale: string): string {
    return locale === 'en' ? 'en-GB' : locale
}

function dayOf(date: string): Date {
    const [y, m, d] = date.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
}

function format(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    try {
        return new Intl.DateTimeFormat(intlLocale(locale), { ...options, timeZone: 'UTC', numberingSystem: 'latn' })
    } catch {
        return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' })
    }
}

function calendarOf(event: BlockOf<'event'>, options: ResolveOptions): { calendarUrl: string | null; calendars: Record<CalendarTarget, string> | null } {
    if (event.calendar === false) return { calendarUrl: null, calendars: null }
    const title = (event.title || options.title || '').trim()
    const { url, choices } = calendarLinks(
        { title, date: event.date, until: event.endDate, start: event.startTime, end: event.startTime ? event.endTime : undefined, place: event.place?.trim() || undefined },
        options.timezone
    )
    return { calendarUrl: url, calendars: choices }
}

function resolveEvent(event: BlockOf<'event'>, options: ResolveOptions): ResolvedExtras['event'] | undefined {
    // A draft's event without its date: nothing to say yet.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date ?? '')) return undefined
    const start = dayOf(event.date)
    const end = event.endDate && event.endDate > event.date ? dayOf(event.endDate) : null
    const date = end
        ? format(options.locale, { day: 'numeric', month: 'long', year: 'numeric' }).formatRange(start, end)
        : format(options.locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(start)
    const time = event.startTime ? (event.endTime ? `${event.startTime} – ${event.endTime}` : event.startTime) : null
    return {
        day: format(options.locale, { day: 'numeric' }).format(start),
        month: format(options.locale, { month: 'short' }).format(start).replace(/\.$/, ''),
        date,
        time,
        ...calendarOf(event, options),
    }
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

/** The video's site and its id there, from any of the addresses people copy. */
function videoOf(url: string): { provider: 'youtube' | 'vimeo' | 'file' | 'link'; id?: string } {
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        return { provider: 'link' }
    }
    const host = parsed.hostname.toLowerCase().replace(/^(www|m|music)\./, '')
    const parts = parsed.pathname.split('/').filter(Boolean)
    if (host === 'youtu.be' && YOUTUBE_ID.test(parts[0] ?? '')) return { provider: 'youtube', id: parts[0] }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        const v = parsed.searchParams.get('v')
        if (parts[0] === 'watch' && v && YOUTUBE_ID.test(v)) return { provider: 'youtube', id: v }
        if (['shorts', 'embed', 'live', 'v'].includes(parts[0]) && YOUTUBE_ID.test(parts[1] ?? '')) return { provider: 'youtube', id: parts[1] }
    }
    if (host === 'player.vimeo.com' && parts[0] === 'video' && /^\d+$/.test(parts[1] ?? '')) return { provider: 'vimeo', id: parts[1] }
    if (host === 'vimeo.com') {
        const id = [...parts].reverse().find((p) => /^\d+$/.test(p))
        if (id) return { provider: 'vimeo', id }
    }
    if (/\.(mp4|mov|webm|m3u8)$/i.test(parsed.pathname)) return { provider: 'file' }
    return { provider: 'link' }
}

function resolveVideo(video: BlockOf<'video'>): ResolvedExtras['video'] {
    const { provider, id } = videoOf(video.url ?? '')
    const poster = video.poster?.src || (provider === 'youtube' ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null)
    const embedUrl = provider === 'youtube' ? `https://www.youtube-nocookie.com/embed/${id}` : provider === 'vimeo' ? `https://player.vimeo.com/video/${id}` : null
    return { provider, poster, embedUrl }
}

/** A contact's words when the editor gave none, by language. */
const CONTACT_WORDS: Record<string, Record<ContactKind, string>> = {
    en: { phone: 'Call', whatsapp: 'WhatsApp', email: 'Email', map: 'Directions', website: 'Website' },
    ar: { phone: 'اتصل', whatsapp: 'واتساب', email: 'البريد الإلكتروني', map: 'الاتجاهات', website: 'الموقع الإلكتروني' },
    fr: { phone: 'Appeler', whatsapp: 'WhatsApp', email: 'E-mail', map: 'Itinéraire', website: 'Site web' },
}

export function contactHref(kind: ContactKind, value: string): string {
    const v = value.trim()
    if (kind === 'phone') return `tel:${v.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')}`
    if (kind === 'whatsapp') return `https://wa.me/${v.replace(/\D/g, '')}`
    if (kind === 'email') return `mailto:${v}`
    return v
}

function resolveContact(contact: BlockOf<'contact'>, locale: string): ResolvedExtras['contact'] {
    const words = CONTACT_WORDS[locale.split('-')[0]] ?? CONTACT_WORDS.en
    return contact.items.map((item) => ({ href: contactHref(item.kind, item.value ?? ''), label: item.label || words[item.kind] }))
}

/** The blocks with what each one needs worked out (`resolved`), for the app and the web. */
export function resolveBlocks(blocks: PageBlock[], options: ResolveOptions): ResolvedBlock[] {
    return blocks.map((block) => {
        const { resolved: _old, ...plain } = block as ResolvedBlock
        let resolved: ResolvedExtras | undefined
        if (plain.type === 'event') {
            const event = resolveEvent(plain, options)
            if (event) resolved = { event }
        } else if (plain.type === 'video') resolved = { video: resolveVideo(plain) }
        else if (plain.type === 'contact') resolved = { contact: resolveContact(plain, options.locale) }
        return resolved ? { ...plain, resolved } : (plain as ResolvedBlock)
    })
}
