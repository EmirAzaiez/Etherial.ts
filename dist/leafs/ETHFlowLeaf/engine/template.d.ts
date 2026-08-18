import type { RunContext } from '../types.js';
declare function nowParts(date: Date, timezone?: string): Record<string, any>;
/**
 * Formats a date with a handful of tokens, in a given zone.
 *
 * Built on `Intl` rather than on arithmetic over the timestamp: an office in
 * Riyadh reading "your appointment is at 09:00" wants 09:00 there, and no
 * amount of adding hours to a UTC value survives a daylight saving change.
 */
export declare function formatDate(value: any, pattern: string, timezone?: string): string;
export declare function renderString(template: string, context: RunContext): string;
export declare function resolveConfig(config: Record<string, any>, context: RunContext): Record<string, any>;
export { nowParts };
