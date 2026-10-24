import { type CaseDraft } from './options.js';
import { type CaseAttachment } from './statuses.js';
/** Opens a case. The hooks stamp its reference and start its clocks. */
export declare function openCase(draft: CaseDraft, options?: {
    transaction?: any;
}): Promise<any>;
/**
 * Staff answer: a reply the customer is told of, or an internal note. With
 * `status`, the case moves in the same go; resolving or closing it tells the
 * customer once, not twice.
 */
export declare function replyToCase(kase: any, message: {
    body: string;
    internal?: boolean;
    attachments?: CaseAttachment[];
    author: any;
    status?: string | null;
}): Promise<any>;
/**
 * The customer says whether the resolution fixed it: closed, or back in
 * progress (`note` then says what is still wrong). Call it on a case that
 * `awaitsConfirmation`. The customer is not told of their own answer.
 */
export declare function confirmResolution(kase: any, answer: {
    fixed: boolean;
    note?: string | null;
}): Promise<any>;
/** The customer's rating of a resolved or closed case. */
export declare function rateCase(kase: any, rating: {
    rating: number;
    note?: string | null;
}): Promise<any>;
/**
 * The files a staff member uploaded through the back-office (ETHMediaLeaf),
 * as a message's attachments: theirs, confirmed, in a case folder and public.
 * Throws on any other.
 */
export declare function attachmentsFromMedia(staffId: number, mediaIds: unknown): Promise<CaseAttachment[]>;
/** A canned reply's text for this case: `{{customer_name}}`, `{{reference}}`, `{{subject}}`, `{{staff_name}}`. */
export declare function renderCannedReply(body: string, kase: any, customer: any, staff: any): string;
/** The active canned replies for a case of this kind, most used first. */
export declare function cannedRepliesFor(kase: any, staff: any): Promise<{
    id: number;
    title: string;
    body: string;
}[]>;
/** The Media ids the cases and their messages keep in JSON, for ETHMediaLeaf's orphan cleanup. */
export declare function caseMediaIds(): Promise<number[]>;
