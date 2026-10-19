import type { CollectionConfig } from './CollectionConfig.js';
/**
 * Concurrent edits on the back-office's edit page.
 *
 * The form sends `If-Match: <updated_at as it loaded it>` with its save. When
 * the record has moved on since, the save is refused with a 409 that says what
 * changed and who changed it, and the back-office decides: merge silently when
 * the two edits touch different fields, ask otherwise. No header, no check —
 * inline and bulk edits, and older back-offices, save as before.
 */
export interface EditConflict {
    changedFields: string[];
    changedBy: {
        id: number | null;
        name: string | null;
    } | null;
    changedAt: string;
}
/**
 * The conflict between the version the form loaded and the record as it is
 * now, or null when there is none: no header, an unreadable one, a model
 * without `updated_at`, or the same version.
 */
export declare function detectEditConflict(collection: CollectionConfig, record: any, ifMatch: unknown): Promise<EditConflict | null>;
