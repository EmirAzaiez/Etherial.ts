import { Platform } from './options.js';
/**
 * What the app at a version does:
 * - `none`: it is the latest, or no version is listed;
 * - `available`: a newer minor version is out, nothing to ask;
 * - `banner`: a banner asks to update from the store; it can be closed;
 * - `required`: the app is blocked until it is updated.
 */
export type UpdateKind = 'none' | 'available' | 'banner' | 'required';
export interface AppUpdate {
    platform: Platform;
    /** The app's version, as it gave it. Null without one: `update` is then null too. */
    version: string | null;
    /** The newest published version. */
    latest: string | null;
    /** The newest required version: an app below it is blocked. */
    minimum: string | null;
    update: UpdateKind | null;
    store_url: string | null;
    /** The banner's or the block's texts, in the app's language: the team's, else the leaf's. */
    title: string | null;
    message: string | null;
}
export declare function platformOf(value: unknown): Platform | null;
/**
 * What the app at `version` on `platform` does, and what it shows, in
 * `locale`. Each newer published version has its say; the strongest wins,
 * and its texts with it (the newest of them).
 */
export declare function appUpdateOf(platform: Platform, version: string | null | undefined, locale: string): Promise<AppUpdate>;
