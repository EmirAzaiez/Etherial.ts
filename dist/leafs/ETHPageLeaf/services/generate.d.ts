import { ETHPageLeafConfig, PageAIConfig, PageBlock } from './options.js';
import { DocumentSource } from './sources.js';
/** `new`: the whole page. `add`: only blocks to add to it. `change`: the whole page again, changed. */
export type GenerateMode = 'new' | 'add' | 'change';
export interface GenerateInput {
    prompt: string;
    /** The languages to write it in, the one on screen first. */
    locales: string[];
    mode: GenerateMode;
    /**
     * The page as it is, per language: for `add` and `change`. The languages
     * not written are read only, to translate from.
     */
    blocks?: Record<string, PageBlock[]>;
    /** The page's title and line, as the form has them. */
    title?: string;
    summary?: string;
    /** Pictures to make the page from (a screenshot of a page, a flyer), base64. */
    images?: GenerateImage[];
    /** PDFs to make the page from (a brochure, a flyer), base64. */
    documents?: DocumentSource[];
    /** Links to pages of websites to make the page from: read before Claude is asked. */
    links?: string[];
}
/** A link, once read: a web page's content, or a PDF it led to (then in `documents`). */
export interface GenerateSource {
    url: string;
    kind: 'page' | 'pdf';
    title: string;
    /** The pictures found on it, which the page may show. */
    images: number;
}
export interface GenerateImage {
    mediaType: string;
    data: string;
}
export type GenerateEvent = {
    event: 'status';
    data: {
        phase: 'reading' | 'thinking' | 'writing';
    };
} | {
    event: 'source';
    data: GenerateSource;
} | {
    event: 'block';
    data: {
        index: number;
        blocks: Record<string, PageBlock>;
    };
} | {
    event: 'done';
    data: {
        count: number;
        images: number;
        links: number;
        note: string | null;
        cut: boolean;
        model: string;
    };
};
/** What the page leaf calls Claude with, or null when the project has no AI. */
export declare function aiOf(config: ETHPageLeafConfig): Required<Pick<PageAIConfig, 'apiKey' | 'model' | 'fallbacks'>> & PageAIConfig | null;
/**
 * Writes the page and tells `emit` as it goes: `status`, one `block` per
 * finished line (the block in each language), then `done`. Throws a
 * PageError when Claude can't be asked or stops on an error.
 */
export declare function generatePage(body: any, emit: (event: GenerateEvent) => void, signal?: AbortSignal): Promise<void>;
/** Whether the back-office may offer it: the project's AI is on and has a key. */
export declare function canGenerate(): boolean;
