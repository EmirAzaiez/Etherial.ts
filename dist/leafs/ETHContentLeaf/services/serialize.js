import etherial from 'etherial';
import { localize } from './options.js';
import { languages } from './state.js';
/** A text in the app's language, else the default one's. Null when there is none. */
function t(text, locale) {
    return localize(text, locale, languages().default) || null;
}
const iso = (date) => (date ? new Date(date).toISOString() : null);
/** An image as the app shows it: its public address in the media leaf's bucket. */
function imageOf(media) {
    var _a, _b, _c, _d, _e;
    if (!media)
        return null;
    const url = (_c = (_b = (_a = etherial.eth_media_leaf) === null || _a === void 0 ? void 0 : _a.getPublicUrl) === null || _b === void 0 ? void 0 : _b.call(_a, media)) !== null && _c !== void 0 ? _c : null;
    if (!url)
        return null;
    return { id: media.id, url, width: (_d = media.width) !== null && _d !== void 0 ? _d : null, height: (_e = media.height) !== null && _e !== void 0 ? _e : null };
}
export function serializeFaqSection(section, locale) {
    var _a;
    return {
        id: section.id,
        title: t(section.title, locale),
        questions: ((_a = section.questions) !== null && _a !== void 0 ? _a : []).map((q) => ({ id: q.id, question: t(q.question, locale), answer: t(q.answer, locale) })),
    };
}
/** What a tap on a contact opens: `tel:`, `https://wa.me/…`, `mailto:`, or the address itself. */
export function hrefOf(kind, value) {
    const digits = value.replace(/[^\d+]/g, '');
    switch (kind) {
        case 'phone':
            return `tel:${digits}`;
        case 'whatsapp':
            return /^https?:\/\//i.test(value) ? value : `https://wa.me/${digits.replace(/^\+/, '')}`;
        case 'email':
            return /^mailto:/i.test(value) ? value : `mailto:${value}`;
        default:
            return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value.replace(/^\/+/, '')}`;
    }
}
export function serializeContact(contact, locale) {
    return {
        id: contact.id,
        kind: contact.kind,
        label: t(contact.label, locale),
        value: contact.value,
        href: hrefOf(contact.kind, contact.value),
        hours: t(contact.hours, locale),
    };
}
export function serializeOffice(office, locale) {
    var _a;
    const pinned = office.latitude !== null && office.longitude !== null;
    return {
        id: office.id,
        name: t(office.name, locale),
        address: t(office.address, locale),
        hours: t(office.hours, locale),
        phone: office.phone,
        phone_href: office.phone ? hrefOf('phone', office.phone) : null,
        email: office.email,
        latitude: office.latitude,
        longitude: office.longitude,
        map_url: (_a = office.map_url) !== null && _a !== void 0 ? _a : (pinned ? `https://www.google.com/maps/search/?api=1&query=${office.latitude},${office.longitude}` : null),
    };
}
/** Without its text: the list of the documents. */
export function serializeLegal(doc, locale, withBody = false) {
    return Object.assign(Object.assign({ id: doc.id, slug: doc.slug, title: t(doc.title, locale), version: doc.version, url: t(doc.url, locale) }, (withBody ? { body: t(doc.body, locale) } : { has_body: !!t(doc.body, locale) })), { published_at: iso(doc.published_at), updated_at: iso(doc.updated_at) });
}
export function serializeBanner(banner, locale) {
    return {
        id: banner.id,
        image: imageOf(banner.image),
        title: t(banner.title, locale),
        subtitle: t(banner.subtitle, locale),
        button: t(banner.button, locale),
        link: banner.link,
        ends_at: iso(banner.ends_at),
    };
}
export function serializeStory(story, locale) {
    var _a, _b, _c, _d;
    const slides = ((_a = story.slides) !== null && _a !== void 0 ? _a : [])
        .map((slide) => ({
        id: slide.id,
        image: imageOf(slide.image),
        title: t(slide.title, locale),
        text: t(slide.text, locale),
        button: slide.link ? t(slide.button, locale) : null,
        link: slide.link,
        duration: slide.duration,
    }))
        // A slide whose image was deleted from the bucket shows nothing.
        .filter((slide) => slide.image);
    return {
        id: story.id,
        title: t(story.title, locale),
        cover: (_d = (_b = imageOf(story.cover)) !== null && _b !== void 0 ? _b : (_c = slides[0]) === null || _c === void 0 ? void 0 : _c.image) !== null && _d !== void 0 ? _d : null,
        published_at: iso(story.published_at),
        // The app marks the story as new while it hasn't seen this one.
        updated_at: iso(story.updated_at),
        slides,
    };
}
