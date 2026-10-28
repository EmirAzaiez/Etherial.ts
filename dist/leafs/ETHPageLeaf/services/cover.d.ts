import type { PageImage } from './options.js';
/**
 * A cover as a record or the back-office gives it: a media's id, a media,
 * an address, `{ src | url }`. Null when there is none, or none to show.
 */
export declare function coverFrom(value: unknown): Promise<PageImage | null>;
