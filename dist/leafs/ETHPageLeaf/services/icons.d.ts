import { PageIcon } from './options.js';
/** Each icon's SVG, drawn in a 24 × 24 box with the current color's stroke. */
export declare const ICON_PATHS: Record<PageIcon, string>;
/** An icon of `PAGE_ICONS`, or undefined. */
export declare function pageIconOf(value: unknown): PageIcon | undefined;
/** The icon a row or an item shows: its own, else the one its words suggest, else `fallback`. */
export declare function iconFor(item: {
    label?: string;
    icon?: unknown;
}, fallback: PageIcon): PageIcon;
