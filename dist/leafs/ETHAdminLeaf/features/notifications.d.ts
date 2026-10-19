import type { MailDefinition } from '../../ETHMailLeaf/services/options.js';
export interface NotificationEmailConfig {
    /** `daily` emails each person what they have not read nor been emailed about. Default `off`. */
    digest?: 'off' | 'daily';
    /** Server-local hour the digest leaves at, 0-23. Default 8. */
    digestHour?: number;
    /** The mail leaf email used when the project lists it. Default `admin_notification`. */
    template?: string;
}
export interface NotificationsConfig {
    /** The back-office's address, e.g. `https://admin.example.com`. Email links point there; without it, no email is sent. */
    appUrl?: string;
    /** Emails, sent right away when the sender asks (mentions do). `false` turns every email off. Default on. */
    email?: boolean | NotificationEmailConfig;
    /** Drop notifications older than this many days, checked daily. Default 90. */
    retentionDays?: number;
    /** Sequelize model the user ids belong to. Default `User`. */
    userModel?: string;
}
export interface NotifyInput {
    to: {
        userIds?: number[];
        adminRoleIds?: number[];
        permission?: {
            collection: string;
            permission: 'view' | 'create' | 'update' | 'delete' | 'actions';
        };
        all?: boolean;
    };
    /** mention, flow, campaign, or any name a project gives its own. */
    type: string;
    title: string;
    body?: string;
    /** A back-office path, e.g. `/orders/12`. */
    link?: string;
    collection?: string;
    recordId?: string | number;
    /** Who caused it: never notified, and named in the bell. */
    actorId?: number | null;
    data?: Record<string, unknown>;
    /** Email it right away too. */
    email?: boolean;
}
export declare const NOTIFICATION_EMAIL = "admin_notification";
export declare function notificationsOptions(value: boolean | NotificationsConfig | undefined): NotificationsConfig | null;
/** Called by the leaf when `features.notifications` is on: until then `notifyAdmins` does nothing. */
export declare function configureNotifications(value: NotificationsConfig | null): void;
export declare function notificationsEnabled(): boolean;
export declare function userIdOf(user: any): number | null;
/** "Sara Ali", else the email: how a person is named in the bell, a note, a mention. */
export declare function adminUserLabel(user: any): string;
/** The users behind these ids, by id. Missing ones are simply absent. */
export declare function loadUsers(ids: number[], modelName?: string): Promise<Map<number, any>>;
/**
 * The people who may open the back-office, optionally only those holding a
 * permission on a collection. Comes from the access helpers (`listAdminUsers`):
 * a project without them has no way to list its staff, so every recipient
 * other than explicit user ids resolves to nobody, with one warning.
 */
export declare function listAdminUsers(filter?: {
    collection?: string;
    permission?: string;
}): Promise<any[]>;
/**
 * Creates one notification per recipient and resolves with how many. Does
 * nothing (0) while `features.notifications` is off, so any code may call it.
 * Rejects only when the rows cannot be written; emails go out afterwards and
 * never hold the caller up.
 */
export declare function notifyAdmins(input: NotifyInput): Promise<number>;
/**
 * The purge, daily, and the digest, checked hourly. Both run under a lease,
 * so with several servers only one of them does each turn.
 */
export declare function scheduleNotificationJobs(): void;
/**
 * The email the leaf sends through the mail leaf, ready to add to its
 * `emails` so the back-office can restyle and translate it:
 * `emails: [...mine, adminNotificationEmail()]`.
 */
export declare function adminNotificationEmail(): MailDefinition;
