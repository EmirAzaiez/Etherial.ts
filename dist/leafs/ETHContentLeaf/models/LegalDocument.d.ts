import { Model } from 'etherial/components/database/provider';
/**
 * A text the app must show as written: the terms of use, the privacy
 * policy… Its text (HTML), or a page of the project's website to open.
 */
export declare class LegalDocument extends Model<LegalDocument> {
    id: number;
    /** What the app asks for: `terms`, `privacy`. Left empty, made from the title. */
    slug: string;
    /** `{ en, ar }` */
    title: Record<string, string>;
    /** The title in the default language: the back-office's lists and search. Written by the leaf. */
    label: string;
    /** `{ en: '<p>…</p>', ar: '…' }`: HTML, from the back-office's editor. */
    body: Record<string, string>;
    /** `{ en: 'https://…/privacy' }`: a page of the website, which the app opens instead of the text. */
    url: Record<string, string>;
    /** `2026-10`, `v3`: what the app shows under the title. */
    version: string | null;
    position: number;
    /** Off: a draft, the app doesn't see it. */
    published: boolean;
    published_at: Date | null;
    created_at: Date;
    updated_at: Date;
    /** Sequelize checks NOT NULL before `check` runs: an address left empty waits for it as ''. */
    static emptySlug(doc: LegalDocument): void;
    static check(doc: LegalDocument): void;
}
