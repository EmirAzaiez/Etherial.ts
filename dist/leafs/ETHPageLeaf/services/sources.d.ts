/** A page of a website, read. */
export interface PageSource {
    url: string;
    title: string;
    /** Its content as Markdown: headings, paragraphs, lists, `![alt](src)`, `[text](href)`. */
    text: string;
    /** Its pictures' addresses (https), the cover first: Claude may put them on the page. */
    images: string[];
}
/** A PDF, base64. */
export interface DocumentSource {
    name: string;
    data: string;
}
export declare const MAX_LINKS = 3;
export declare const MAX_DOCUMENTS = 2;
/** The links to read, as the back-office sends them: https or http, each once. */
export declare function cleanLinks(value: unknown): string[];
/** The PDFs, as the back-office sends them: `[{ name, data }]`, data a data: URL or the base64 alone. */
export declare function cleanDocuments(value: unknown): DocumentSource[];
/**
 * Opens a link: a web page is read into a `PageSource`, a PDF comes back as
 * a document to send as it is. Throws a PageError saying what to do when it
 * can't be read (not found, not public, a page drawn by scripts only).
 */
export declare function readLink(link: string, signal?: AbortSignal): Promise<{
    page: PageSource;
} | {
    document: DocumentSource;
}>;
/**
 * A page's content as Markdown, and its pictures: the site's `<main>` (or
 * its article, or its body without header and footer), without what is
 * not the page (scripts, menus, forms, sidebars, pop-ups). A line the
 * site repeats (a desktop and a phone version of a section) comes once.
 */
export declare function readablePage(html: string, pageUrl: URL): PageSource;
