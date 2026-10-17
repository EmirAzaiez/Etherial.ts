import type { Request, Response, NextFunction } from 'express';
import { AdminLoginLog } from '../models/AdminLoginLog.js';
export interface LoginJournalConfig {
    /** Login routes watched even when the request is not tagged by the back-office. */
    routes?: string[];
    /** Collection the `user_id` column links to. Default `users`. */
    usersCollection?: string;
    /** Field of that collection shown for the user. Default `email`. */
    usersDisplayField?: string;
    /** Sequelize model the user ids belong to, joined so the list names the account. Default `User`. */
    userModel?: string;
}
export declare const LOGIN_JOURNAL_COLLECTION = "admin-logins";
export declare function loginJournalOptions(value: boolean | LoginJournalConfig | undefined): LoginJournalConfig | null;
/** "Chrome 141 on macOS" — enough to recognise a session, not a full parser. */
export declare function describeClient(ua: string | undefined): string | null;
export declare function loginJournalMiddleware(config: LoginJournalConfig): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Joins each row to its account when the project has a user model, so the list
 * names the person instead of looking the id up in a page of users. No
 * constraint: the table must not depend on the project's.
 */
export declare function linkLoginJournalToUsers(config: LoginJournalConfig): boolean;
/** The read-only collection the back-office lists the journal with. */
export declare function loginJournalCollection(config: LoginJournalConfig, hasUsers: boolean, linked: boolean): {
    name: string;
    model: typeof AdminLoginLog;
    crud: ("list" | "show")[];
    exportable: boolean;
    meta: {
        label: string;
        labelPlural: string;
        icon: string;
        description: string;
        group: string;
        order: number;
    };
    fields: ({
        name: string;
        type: "integer";
        readonly: boolean;
        sortable: boolean;
        label?: undefined;
        filterable?: undefined;
        options?: undefined;
        searchable?: undefined;
        relation?: undefined;
    } | {
        name: string;
        type: "select";
        label: string;
        filterable: boolean;
        options: {
            value: string;
            label: string;
            color: string;
        }[];
        readonly?: undefined;
        sortable?: undefined;
        searchable?: undefined;
        relation?: undefined;
    } | {
        name: string;
        type: "string";
        label: string;
        searchable: boolean;
        sortable: boolean;
        readonly?: undefined;
        filterable?: undefined;
        options?: undefined;
        relation?: undefined;
    } | {
        name: string;
        type: "relation";
        label: string;
        filterable: boolean;
        relation: {
            collection: string;
            displayField: string;
        };
        readonly?: undefined;
        sortable?: undefined;
        options?: undefined;
        searchable?: undefined;
    } | {
        name: string;
        type: "integer";
        label: string;
        filterable: boolean;
        readonly?: undefined;
        sortable?: undefined;
        options?: undefined;
        searchable?: undefined;
        relation?: undefined;
    } | {
        name: string;
        type: "string";
        label: string;
        filterable: boolean;
        readonly?: undefined;
        sortable?: undefined;
        options?: undefined;
        searchable?: undefined;
        relation?: undefined;
    } | {
        name: string;
        type: "string";
        label: string;
        searchable: boolean;
        filterable: boolean;
        readonly?: undefined;
        sortable?: undefined;
        options?: undefined;
        relation?: undefined;
    } | {
        name: string;
        type: "string";
        label: string;
        readonly?: undefined;
        sortable?: undefined;
        filterable?: undefined;
        options?: undefined;
        searchable?: undefined;
        relation?: undefined;
    } | {
        name: string;
        type: "text";
        label: string;
        readonly: boolean;
        sortable?: undefined;
        filterable?: undefined;
        options?: undefined;
        searchable?: undefined;
        relation?: undefined;
    } | {
        name: string;
        type: "datetime";
        label: string;
        readonly: boolean;
        sortable: boolean;
        filterable: boolean;
        options?: undefined;
        searchable?: undefined;
        relation?: undefined;
    })[];
    views: {
        list: {
            fields: string[];
            sort: {
                field: string;
                direction: "desc";
            };
            search: string[];
            filters: string[];
            include: {
                association: string;
                attributes: string[];
            }[];
        };
        show: {
            layout: "sections";
            sections: {
                title: string;
                fields: string[];
            }[];
            include: {
                association: string;
                attributes: string[];
            }[];
        };
    };
};
