import type { Request, Response } from 'express';
/**
 * No sign-in: these are what the company tells everyone, guests included.
 * Only banners and stories look at who asks (their audience). A draft is
 * never served. Each answer says the language it is written in.
 */
export default class ETHContentAppController {
    /** GET /content/languages — those the app gets, the default first: for a language picker. */
    languages(req: Request, res: Response): Promise<any>;
    /** GET /content/faq — the sections and their questions, in order. A section without a question isn't sent. */
    faq(req: Request, res: Response): Promise<any>;
    /** GET /content/contacts — the ways to reach the company, and its offices. */
    contacts(req: Request, res: Response): Promise<any>;
    /** GET /content/legal — the published documents, without their text. */
    legal(req: Request, res: Response): Promise<any>;
    /** GET /content/legal/:slug — one document, with its text (HTML). */
    legalDocument(req: Request, res: Response): Promise<any>;
    /** GET /content/banners — the home screen's carousel, for whoever asks. A banner whose image is gone isn't sent. */
    banners(req: Request, res: Response): Promise<any>;
    /** GET /content/stories — the bubbles and their slides, for whoever asks. A story without a slide to show isn't sent. */
    stories(req: Request, res: Response): Promise<any>;
    /**
     * GET /content/app-version?platform=ios&version=1.4.2 — whether the app
     * must, or is asked to, update. The app's own headers do too
     * (`x-app-platform`, `x-app-version`).
     */
    appVersion(req: Request, res: Response): Promise<any>;
}
