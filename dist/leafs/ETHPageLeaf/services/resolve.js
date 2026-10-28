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
import { calendarLinks } from './calendar.js';
/** Bare `en` reads dates the American way ("November 14"); the pages are written for the rest of the world. */
function intlLocale(locale) {
    return locale === 'en' ? 'en-GB' : locale;
}
function dayOf(date) {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}
function format(locale, options) {
    try {
        return new Intl.DateTimeFormat(intlLocale(locale), Object.assign(Object.assign({}, options), { timeZone: 'UTC', numberingSystem: 'latn' }));
    }
    catch (_a) {
        return new Intl.DateTimeFormat('en-GB', Object.assign(Object.assign({}, options), { timeZone: 'UTC' }));
    }
}
function calendarOf(event, options) {
    var _a;
    if (event.calendar === false)
        return { calendarUrl: null, calendars: null };
    const title = (event.title || options.title || '').trim();
    const { url, choices } = calendarLinks({ title, date: event.date, until: event.endDate, start: event.startTime, end: event.startTime ? event.endTime : undefined, place: ((_a = event.place) === null || _a === void 0 ? void 0 : _a.trim()) || undefined }, options.timezone);
    return { calendarUrl: url, calendars: choices };
}
function resolveEvent(event, options) {
    var _a;
    // A draft's event without its date: nothing to say yet.
    if (!/^\d{4}-\d{2}-\d{2}$/.test((_a = event.date) !== null && _a !== void 0 ? _a : ''))
        return undefined;
    const start = dayOf(event.date);
    const end = event.endDate && event.endDate > event.date ? dayOf(event.endDate) : null;
    const date = end
        ? format(options.locale, { day: 'numeric', month: 'long', year: 'numeric' }).formatRange(start, end)
        : format(options.locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(start);
    const time = event.startTime ? (event.endTime ? `${event.startTime} – ${event.endTime}` : event.startTime) : null;
    return Object.assign({ day: format(options.locale, { day: 'numeric' }).format(start), month: format(options.locale, { month: 'short' }).format(start).replace(/\.$/, ''), date,
        time }, calendarOf(event, options));
}
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
/** The video's site and its id there, from any of the addresses people copy. */
function videoOf(url) {
    var _a, _b, _c;
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch (_d) {
        return { provider: 'link' };
    }
    const host = parsed.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (host === 'youtu.be' && YOUTUBE_ID.test((_a = parts[0]) !== null && _a !== void 0 ? _a : ''))
        return { provider: 'youtube', id: parts[0] };
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
        const v = parsed.searchParams.get('v');
        if (parts[0] === 'watch' && v && YOUTUBE_ID.test(v))
            return { provider: 'youtube', id: v };
        if (['shorts', 'embed', 'live', 'v'].includes(parts[0]) && YOUTUBE_ID.test((_b = parts[1]) !== null && _b !== void 0 ? _b : ''))
            return { provider: 'youtube', id: parts[1] };
    }
    if (host === 'player.vimeo.com' && parts[0] === 'video' && /^\d+$/.test((_c = parts[1]) !== null && _c !== void 0 ? _c : ''))
        return { provider: 'vimeo', id: parts[1] };
    if (host === 'vimeo.com') {
        const id = [...parts].reverse().find((p) => /^\d+$/.test(p));
        if (id)
            return { provider: 'vimeo', id };
    }
    if (/\.(mp4|mov|webm|m3u8)$/i.test(parsed.pathname))
        return { provider: 'file' };
    return { provider: 'link' };
}
function resolveVideo(video) {
    var _a, _b;
    const { provider, id } = videoOf((_a = video.url) !== null && _a !== void 0 ? _a : '');
    const poster = ((_b = video.poster) === null || _b === void 0 ? void 0 : _b.src) || (provider === 'youtube' ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null);
    const embedUrl = provider === 'youtube' ? `https://www.youtube-nocookie.com/embed/${id}` : provider === 'vimeo' ? `https://player.vimeo.com/video/${id}` : null;
    return { provider, poster, embedUrl };
}
/** A contact's words when the editor gave none, by language. */
const CONTACT_WORDS = {
    en: { phone: 'Call', whatsapp: 'WhatsApp', email: 'Email', map: 'Directions', website: 'Website' },
    ar: { phone: 'اتصل', whatsapp: 'واتساب', email: 'البريد الإلكتروني', map: 'الاتجاهات', website: 'الموقع الإلكتروني' },
    fr: { phone: 'Appeler', whatsapp: 'WhatsApp', email: 'E-mail', map: 'Itinéraire', website: 'Site web' },
};
export function contactHref(kind, value) {
    const v = value.trim();
    if (kind === 'phone')
        return `tel:${v.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')}`;
    if (kind === 'whatsapp')
        return `https://wa.me/${v.replace(/\D/g, '')}`;
    if (kind === 'email')
        return `mailto:${v}`;
    return v;
}
function resolveContact(contact, locale) {
    var _a;
    const words = (_a = CONTACT_WORDS[locale.split('-')[0]]) !== null && _a !== void 0 ? _a : CONTACT_WORDS.en;
    return contact.items.map((item) => { var _a; return ({ href: contactHref(item.kind, (_a = item.value) !== null && _a !== void 0 ? _a : ''), label: item.label || words[item.kind] }); });
}
/** The blocks with what each one needs worked out (`resolved`), for the app and the web. */
export function resolveBlocks(blocks, options) {
    return blocks.map((block) => {
        const _a = block, { resolved: _old } = _a, plain = __rest(_a, ["resolved"]);
        let resolved;
        if (plain.type === 'event') {
            const event = resolveEvent(plain, options);
            if (event)
                resolved = { event };
        }
        else if (plain.type === 'video')
            resolved = { video: resolveVideo(plain) };
        else if (plain.type === 'contact')
            resolved = { contact: resolveContact(plain, options.locale) };
        return resolved ? Object.assign(Object.assign({}, plain), { resolved }) : plain;
    });
}
