import { AdminNote } from '../models/AdminNote.js';
export declare const MENTION: RegExp;
export declare const NOTE_MAX_LENGTH = 10000;
export interface SerializedNote {
    id: number;
    body: string;
    mentions: number[];
    author: {
        id: number;
        name: string;
    } | null;
    created_at: Date;
    updated_at: Date;
    edited_at: Date | null;
    can_edit: boolean;
    can_delete: boolean;
}
/** The user ids a body mentions, in order, once each. */
export declare function parseMentions(body: string): number[];
/** The body as an email or the bell shows it: `@Sara Ali` rather than the markup. */
export declare function plainNote(body: string): string;
/** Whether this person may read and write notes on this collection's records. */
export declare function canUseNotes(user: any, collection: string): Promise<boolean>;
/**
 * Staff who can see the collection, for the mention picker: matched on name
 * or email, at most `limit`, the asker left out.
 */
export declare function mentionableUsers(collection: string, query: string, exceptId: number | null, limit?: number): Promise<{
    id: number;
    name: string;
    email?: string;
}[]>;
export declare function serializeNotes(notes: AdminNote[], viewer: any): Promise<SerializedNote[]>;
export declare function listNotes(collection: string, recordId: string): Promise<AdminNote[]>;
export declare function createNote(collection: string, recordId: string, body: string, author: any): Promise<AdminNote>;
/** Only the people mentioned for the first time hear about an edit. */
export declare function updateNote(note: AdminNote, body: string, author: any): Promise<AdminNote>;
export declare function canDeleteNote(note: AdminNote, user: any): Promise<boolean>;
