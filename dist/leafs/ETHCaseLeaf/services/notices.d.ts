import { type CaseAlerts, type CaseNoticeKind } from './options.js';
/**
 * Tells the customer through the project's `notify`. Awaited, as the project
 * may expect its notification written once the write returns; its failure
 * only prints.
 */
export declare function notifyCustomer(kase: any, kind: CaseNoticeKind, comment?: any): Promise<void>;
declare const excerpt: (text: string | null | undefined, length?: number) => string | undefined;
/**
 * A line in the staff's bell (ETHAdminLeaf), in the background: to the
 * assignee when there is one and `assignee` is asked, else to whoever may
 * change cases. The person who did it is never told.
 */
export declare function alertStaff(kind: keyof CaseAlerts, kase: any, message: {
    type: string;
    title: string;
    body?: string | null;
    assignee?: boolean;
    userIds?: number[];
}): void;
export declare const caseTitle: {
    created: (kase: any) => string;
    reply: (kase: any) => string;
    rejected: (kase: any) => string;
    assigned: (kase: any) => string;
    overdue: (kase: any) => string;
};
export { excerpt };
