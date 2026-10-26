import type { Banner } from '../models/Banner.js';
import type { Contact } from '../models/Contact.js';
import type { FaqSection } from '../models/FaqSection.js';
import type { LegalDocument } from '../models/LegalDocument.js';
import type { Office } from '../models/Office.js';
import type { Story } from '../models/Story.js';
import { ContactKind } from './options.js';
export interface AppFaqSection {
    id: number;
    title: string | null;
    questions: {
        id: number;
        question: string | null;
        answer: string | null;
    }[];
}
export declare function serializeFaqSection(section: FaqSection, locale: string): AppFaqSection;
/** What a tap on a contact opens: `tel:`, `https://wa.me/…`, `mailto:`, or the address itself. */
export declare function hrefOf(kind: ContactKind, value: string): string;
export declare function serializeContact(contact: Contact, locale: string): {
    id: number;
    kind: "email" | "phone" | "whatsapp" | "website" | "instagram" | "facebook" | "x" | "linkedin" | "youtube" | "tiktok" | "snapchat";
    label: string;
    value: string;
    href: string;
    hours: string;
};
export declare function serializeOffice(office: Office, locale: string): {
    id: number;
    name: string;
    address: string;
    hours: string;
    phone: string;
    phone_href: string;
    email: string;
    latitude: number;
    longitude: number;
    map_url: string;
};
/** Without its text: the list of the documents. */
export declare function serializeLegal(doc: LegalDocument, locale: string, withBody?: boolean): {
    published_at: string;
    updated_at: string;
    body: string;
    id: number;
    slug: string;
    title: string;
    version: string;
    url: string;
} | {
    published_at: string;
    updated_at: string;
    has_body: boolean;
    id: number;
    slug: string;
    title: string;
    version: string;
    url: string;
};
export declare function serializeBanner(banner: Banner, locale: string): {
    id: number;
    image: {
        id: number;
        url: string;
        width: number | null;
        height: number | null;
    };
    title: string;
    subtitle: string;
    button: string;
    link: string;
    ends_at: string;
};
export declare function serializeStory(story: Story, locale: string): {
    id: number;
    title: string;
    cover: {
        id: number;
        url: string;
        width: number | null;
        height: number | null;
    };
    published_at: string;
    updated_at: string;
    slides: {
        id: number;
        image: {
            id: number;
            url: string;
            width: number | null;
            height: number | null;
        };
        title: string;
        text: string;
        button: string;
        link: string;
        duration: number;
    }[];
};
