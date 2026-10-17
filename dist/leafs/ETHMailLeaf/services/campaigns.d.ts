import { MailCampaignStatus } from '../models/MailCampaign.js';
import { MailVersion } from './templates.js';
import { MailAudience } from './options.js';
type Content = Record<string, MailVersion>;
export declare function campaignVariables(): {
    name: string;
    label: string;
    example: string;
}[];
export declare function listAudiences(): Promise<MailAudience[]>;
/** How many people an audience reaches today, by language. */
export declare function countAudience(key: unknown): Promise<{
    audience: string;
    reachable: number;
    unsubscribed: number;
    /** No address, an invalid one, or one already listed. */
    invalid: number;
    byLocale: Record<string, number>;
}>;
export declare function listCampaigns(query: any): Promise<{
    items: {
        id: number;
        name: string;
        status: MailCampaignStatus;
        audience: string;
        audienceLabel: string;
        subject: any;
        locales: string[];
        scheduledAt: Date;
        startedAt: Date;
        finishedAt: Date;
        stats: {
            recipients: number;
            sent: number;
            failed: number;
            skipped: number;
            unsubscribed: number;
            pending: number;
        };
        error: string;
        createdAt: Date;
        updatedAt: Date;
        createdBy: {
            id: number;
            name: string;
        };
        updatedBy: {
            id: number;
            name: string;
        };
        scheduledBy: {
            id: number;
            name: string;
        };
    }[];
    total: number;
    page: number;
    limit: number;
}>;
export declare function readCampaign(idInput: unknown): Promise<{
    content: Content;
    editable: boolean;
    /** Written in the content, but no recipient has it: it will come out blank. */
    unknown: string[];
    id: number;
    name: string;
    status: MailCampaignStatus;
    audience: string;
    audienceLabel: string;
    subject: any;
    locales: string[];
    scheduledAt: Date;
    startedAt: Date;
    finishedAt: Date;
    stats: {
        recipients: number;
        sent: number;
        failed: number;
        skipped: number;
        unsubscribed: number;
        pending: number;
    };
    error: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: {
        id: number;
        name: string;
    };
    updatedBy: {
        id: number;
        name: string;
    };
    scheduledBy: {
        id: number;
        name: string;
    };
}>;
export declare function createCampaign(body: any, userId: number | null): Promise<{
    content: Content;
    editable: boolean;
    /** Written in the content, but no recipient has it: it will come out blank. */
    unknown: string[];
    id: number;
    name: string;
    status: MailCampaignStatus;
    audience: string;
    audienceLabel: string;
    subject: any;
    locales: string[];
    scheduledAt: Date;
    startedAt: Date;
    finishedAt: Date;
    stats: {
        recipients: number;
        sent: number;
        failed: number;
        skipped: number;
        unsubscribed: number;
        pending: number;
    };
    error: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: {
        id: number;
        name: string;
    };
    updatedBy: {
        id: number;
        name: string;
    };
    scheduledBy: {
        id: number;
        name: string;
    };
}>;
export declare function updateCampaign(idInput: unknown, body: any, userId: number | null): Promise<{
    content: Content;
    editable: boolean;
    /** Written in the content, but no recipient has it: it will come out blank. */
    unknown: string[];
    id: number;
    name: string;
    status: MailCampaignStatus;
    audience: string;
    audienceLabel: string;
    subject: any;
    locales: string[];
    scheduledAt: Date;
    startedAt: Date;
    finishedAt: Date;
    stats: {
        recipients: number;
        sent: number;
        failed: number;
        skipped: number;
        unsubscribed: number;
        pending: number;
    };
    error: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: {
        id: number;
        name: string;
    };
    updatedBy: {
        id: number;
        name: string;
    };
    scheduledBy: {
        id: number;
        name: string;
    };
}>;
export declare function deleteCampaign(idInput: unknown): Promise<{
    deleted: boolean;
    id: number;
}>;
export declare function duplicateCampaign(idInput: unknown, userId: number | null): Promise<{
    content: Content;
    editable: boolean;
    /** Written in the content, but no recipient has it: it will come out blank. */
    unknown: string[];
    id: number;
    name: string;
    status: MailCampaignStatus;
    audience: string;
    audienceLabel: string;
    subject: any;
    locales: string[];
    scheduledAt: Date;
    startedAt: Date;
    finishedAt: Date;
    stats: {
        recipients: number;
        sent: number;
        failed: number;
        skipped: number;
        unsubscribed: number;
        pending: number;
    };
    error: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: {
        id: number;
        name: string;
    };
    updatedBy: {
        id: number;
        name: string;
    };
    scheduledBy: {
        id: number;
        name: string;
    };
}>;
export declare function scheduleCampaign(idInput: unknown, body: any, userId: number | null, origin: string | null): Promise<{
    content: Content;
    editable: boolean;
    /** Written in the content, but no recipient has it: it will come out blank. */
    unknown: string[];
    id: number;
    name: string;
    status: MailCampaignStatus;
    audience: string;
    audienceLabel: string;
    subject: any;
    locales: string[];
    scheduledAt: Date;
    startedAt: Date;
    finishedAt: Date;
    stats: {
        recipients: number;
        sent: number;
        failed: number;
        skipped: number;
        unsubscribed: number;
        pending: number;
    };
    error: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: {
        id: number;
        name: string;
    };
    updatedBy: {
        id: number;
        name: string;
    };
    scheduledBy: {
        id: number;
        name: string;
    };
}>;
export declare function unscheduleCampaign(idInput: unknown, userId: number | null): Promise<{
    content: Content;
    editable: boolean;
    /** Written in the content, but no recipient has it: it will come out blank. */
    unknown: string[];
    id: number;
    name: string;
    status: MailCampaignStatus;
    audience: string;
    audienceLabel: string;
    subject: any;
    locales: string[];
    scheduledAt: Date;
    startedAt: Date;
    finishedAt: Date;
    stats: {
        recipients: number;
        sent: number;
        failed: number;
        skipped: number;
        unsubscribed: number;
        pending: number;
    };
    error: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: {
        id: number;
        name: string;
    };
    updatedBy: {
        id: number;
        name: string;
    };
    scheduledBy: {
        id: number;
        name: string;
    };
}>;
/** Stops it: what has left has left, the rest stays home. */
export declare function cancelCampaign(idInput: unknown, userId: number | null): Promise<{
    content: Content;
    editable: boolean;
    /** Written in the content, but no recipient has it: it will come out blank. */
    unknown: string[];
    id: number;
    name: string;
    status: MailCampaignStatus;
    audience: string;
    audienceLabel: string;
    subject: any;
    locales: string[];
    scheduledAt: Date;
    startedAt: Date;
    finishedAt: Date;
    stats: {
        recipients: number;
        sent: number;
        failed: number;
        skipped: number;
        unsubscribed: number;
        pending: number;
    };
    error: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: {
        id: number;
        name: string;
    };
    updatedBy: {
        id: number;
        name: string;
    };
    scheduledBy: {
        id: number;
        name: string;
    };
}>;
/** A draft as a recipient sees it, with the example variables and the unsubscribe line. */
export declare function previewCampaign(body: any, origin: string | null): Promise<{
    unknown: string[];
    subject: string;
    preheader: string;
    html: string;
    text: string;
    locale: string;
    dir: "ltr" | "rtl";
    missing: string[];
}>;
/** The draft in one language to one address, `[Test]` in front of the subject. Its unsubscribe link works. */
export declare function testCampaign(body: any, fallbackTo: string | null, origin: string | null): Promise<{
    sent: boolean;
    to: any;
    subject: string;
    locale: string;
}>;
export declare function listRecipients(idInput: unknown, query: any): Promise<{
    items: {
        id: number;
        email: string;
        userId: number;
        locale: string;
        status: import("../app.js").MailRecipientStatus;
        error: string;
        sentAt: Date;
        unsubscribed: boolean;
    }[];
    total: number;
    page: number;
    limit: number;
}>;
/**
 * Sends the due campaigns every 20 seconds. The first sweep waits: a CLI
 * command boots the app too, and is usually done before it.
 */
export declare function startCampaignSweep(): void;
/** What the back-office needs to open the Campaigns page. */
export declare function campaignsFeature(): {
    locales: string[];
    defaultLocale: string;
    rtlLocales: string[];
    variables: {
        name: string;
        label: string;
        example: string;
    }[];
    perMinute: number;
    dir: {
        [k: string]: string;
    };
};
export {};
