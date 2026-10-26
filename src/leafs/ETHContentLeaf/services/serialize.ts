import etherial from 'etherial'

import type { Banner } from '../models/Banner.js'
import type { Contact } from '../models/Contact.js'
import type { FaqSection } from '../models/FaqSection.js'
import type { LegalDocument } from '../models/LegalDocument.js'
import type { Office } from '../models/Office.js'
import type { Story } from '../models/Story.js'
import { ContactKind, localize } from './options.js'
import { languages, state } from './state.js'

/** A text in the app's language, else the default one's. Null when there is none. */
function t(text: Record<string, string> | null | undefined, locale: string): string | null {
    return localize(text, locale, languages().default) || null
}

const iso = (date: Date | string | null | undefined) => (date ? new Date(date).toISOString() : null)

/** An image as the app shows it: its public address in the media leaf's bucket. */
function imageOf(media: any): { id: number; url: string; width: number | null; height: number | null } | null {
    if (!media) return null
    const url = (etherial as any).eth_media_leaf?.getPublicUrl?.(media) ?? null
    if (!url) return null
    return { id: media.id, url, width: media.width ?? null, height: media.height ?? null }
}

export interface AppFaqSection {
    id: number
    title: string | null
    questions: { id: number; question: string | null; answer: string | null }[]
}

export function serializeFaqSection(section: FaqSection, locale: string): AppFaqSection {
    return {
        id: section.id,
        title: t(section.title, locale),
        questions: (section.questions ?? []).map((q) => ({ id: q.id, question: t(q.question, locale), answer: t(q.answer, locale) })),
    }
}

/** What a tap on a contact opens: `tel:`, `https://wa.me/…`, `mailto:`, or the address itself. */
export function hrefOf(kind: ContactKind, value: string): string {
    const digits = value.replace(/[^\d+]/g, '')
    switch (kind) {
        case 'phone':
            return `tel:${digits}`
        case 'whatsapp':
            return /^https?:\/\//i.test(value) ? value : `https://wa.me/${digits.replace(/^\+/, '')}`
        case 'email':
            return /^mailto:/i.test(value) ? value : `mailto:${value}`
        default:
            return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value.replace(/^\/+/, '')}`
    }
}

export function serializeContact(contact: Contact, locale: string) {
    return {
        id: contact.id,
        kind: contact.kind,
        label: t(contact.label, locale),
        value: contact.value,
        href: hrefOf(contact.kind, contact.value),
        hours: t(contact.hours, locale),
    }
}

export function serializeOffice(office: Office, locale: string) {
    const pinned = office.latitude !== null && office.longitude !== null
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
        map_url: office.map_url ?? (pinned ? `https://www.google.com/maps/search/?api=1&query=${office.latitude},${office.longitude}` : null),
    }
}

/** Without its text: the list of the documents. */
export function serializeLegal(doc: LegalDocument, locale: string, withBody = false) {
    return {
        id: doc.id,
        slug: doc.slug,
        title: t(doc.title, locale),
        version: doc.version,
        url: t(doc.url, locale),
        ...(withBody ? { body: t(doc.body, locale) } : { has_body: !!t(doc.body, locale) }),
        published_at: iso(doc.published_at),
        updated_at: iso(doc.updated_at),
    }
}

export function serializeBanner(banner: Banner, locale: string) {
    return {
        id: banner.id,
        image: imageOf(banner.image),
        title: t(banner.title, locale),
        subtitle: t(banner.subtitle, locale),
        button: t(banner.button, locale),
        link: banner.link,
        ends_at: iso(banner.ends_at),
    }
}

export function serializeStory(story: Story, locale: string) {
    const slides = (story.slides ?? [])
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
        .filter((slide) => slide.image)
    return {
        id: story.id,
        title: t(story.title, locale),
        cover: imageOf(story.cover) ?? slides[0]?.image ?? null,
        published_at: iso(story.published_at),
        // The app marks the story as new while it hasn't seen this one.
        updated_at: iso(story.updated_at),
        slides,
    }
}
