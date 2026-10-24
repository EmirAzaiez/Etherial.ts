import type { LeafSync } from '../../../components/sync/index.js';
export declare const CASES_COLLECTION = "cases";
export declare const COMMENTS_COLLECTION = "case-comments";
export declare const CANNED_REPLIES_COLLECTION = "case-canned-replies";
export declare const SLA_POLICIES_COLLECTION = "case-sla-policies";
export declare const EVENTS_COLLECTION = "case-events";
/** The routes the back-office's conversation panel calls. */
export declare const ADMIN_PREFIX = "/admin/cases";
/** The project's model names, as registered in Sequelize. */
export interface CaseModelNames {
    Case: string;
    CaseComment: string;
}
/** A value of a select (kind, category, priority) and how the back-office shows it. */
export interface CaseOption {
    value: string;
    label: string;
    color?: string;
}
export declare const DEFAULT_KINDS: CaseOption[];
export declare const DEFAULT_PRIORITIES: CaseOption[];
export declare const DEFAULT_CATEGORIES: CaseOption[];
/** What a customer is told about, through `notify`. */
export type CaseNoticeKind = 'reply' | 'resolved' | 'closed';
export interface CaseNotice {
    kind: CaseNoticeKind;
    /** The case, as saved. */
    case: any;
    /** The reply, for `reply`. */
    comment?: any;
}
/** A case to open: the columns of the project's model, `user_id` and `subject` at least. */
export interface CaseDraft {
    user_id: number | null;
    subject: string;
    description?: string | null;
    kind?: string;
    category?: string;
    priority?: string;
    /** APP, BACKOFFICE, SURVEY… Default 'APP'. */
    channel?: string;
    [column: string]: unknown;
}
/** The staff alerts in the back-office's bell. */
export interface CaseAlerts {
    /** A case is opened (not by staff). Default on. */
    created?: boolean;
    /** The customer answers: to the assignee, else to whoever may handle cases. Default on. */
    customerReply?: boolean;
    /** Someone else assigns a case to you. Default on. */
    assigned?: boolean;
    /** A case goes past its first-answer or resolution time. Default on. */
    overdue?: boolean;
}
export interface ETHCaseLeafConfig {
    /** The project's model names, when they differ from the defaults. */
    models?: Partial<CaseModelNames>;
    /** The kinds of case ('MAINTENANCE'…). The SLA policies and canned replies are narrowed by them. */
    kinds?: CaseOption[];
    categories?: CaseOption[];
    priorities?: CaseOption[];
    /** The status names and colors staff read, when they differ from the leaf's. */
    statuses?: Partial<Record<string, {
        label?: string;
        color?: string;
    }>>;
    /** The customers' model, back-office collection and the field naming them. Default 'User' / 'users' / 'email'. */
    customers?: {
        model?: string;
        collection?: string;
        displayField?: string;
    };
    /**
     * What a case is about (a unit): its column on the cases, declared by the
     * project's model. Shown in the back-office and in the conversation.
     */
    subject?: {
        /** Column on the cases: 'unit_id'. */
        field: string;
        /** Its model: 'Unit'. */
        model?: string;
        /** Its back-office collection: 'units'. */
        collection?: string;
        displayField?: string;
        /** 'Unit'. */
        label?: string;
    };
    /** The name a staff reply is signed with in the app. Default: their first name, else "Customer care". */
    staffName?: (user: any) => string;
    /** CASE-000123 on every case written without one. `false` leaves the reference to the project. */
    reference?: {
        prefix?: string;
        digits?: number;
    } | false;
    /**
     * Tells the customer: a staff reply, their case resolved, closed. Awaited;
     * its failure is logged and never fails the write. A write passing
     * `{ notify: false }` tells nobody (the customer did it themselves).
     */
    notify?: (notice: CaseNotice) => unknown;
    /**
     * A case handled elsewhere (read from a CRM): returns why, and staff can
     * neither answer it nor change it here; no clock, no alert. Null otherwise.
     */
    readOnly?: (kase: any) => string | null | undefined;
    /** The staff alerts; `false` turns them all off. Each is on by default. */
    alerts?: false | CaseAlerts;
    /**
     * Files on staff messages: 'all' (the default), 'internal' (internal notes
     * only, while the app does not show them on replies) or false.
     */
    staffAttachments?: 'all' | 'internal' | false;
    /** The media folders staff upload into (ETHMediaLeaf rules). Default ['case-attachments']. */
    attachmentFolders?: string[];
    /** Sends each case to an outside system (`components/sync`). */
    sync?: LeafSync;
    /** Sends each message that is not internal (`components/sync`). */
    syncComments?: LeafSync;
    /**
     * Opens a case from a survey answer (ETHSurveyLeaf): returns the case to
     * open, or null. Called once, when the answer comes in. Default: off.
     */
    fromSurvey?: (response: any) => CaseDraft | null | undefined | Promise<CaseDraft | null | undefined>;
    /** The back-office the leaf registers. */
    admin?: {
        /** The sidebar group. Default 'Support'. */
        group?: string;
        /** How staff call a case and its customer: 'Request' / 'Requests' / 'Owner'. Default 'Case' / 'Cases' / 'Customer'. */
        words?: {
            case?: string;
            cases?: string;
            customer?: string;
        };
        /** Changes a collection before it is registered: returns it, changed or replaced. */
        extend?: (name: string, collection: any) => any;
    };
}
/** The running leaf's config, for its controllers, hooks and services. */
export declare const state: {
    config: ETHCaseLeafConfig;
};
/** The project's models, resolved by name: they exist once the database ran. */
export declare function caseModels(): Record<keyof CaseModelNames, any>;
/** A model of the project the config names (the customers', the subject's), or null. */
export declare function projectModel(name?: string | null): any;
export declare const kindsOf: () => CaseOption[];
export declare const categoriesOf: () => CaseOption[];
export declare const prioritiesOf: () => CaseOption[];
export declare function customersOf(): {
    model: string;
    collection: string;
    displayField: string;
};
/** The label of `value` among `list`, or the value itself. */
export declare const labelIn: (list: CaseOption[], value: string | null | undefined) => string;
export declare function alertOn(kind: keyof CaseAlerts): boolean;
/** Why staff cannot handle this case here, or null. */
export declare function readOnlyReason(kase: any): string | null;
export declare function staffNameOf(user: any): string;
export declare function referenceOf(id: number): string | null;
/** Whether staff may put files on this message. */
export declare function attachmentsAllowed(internal: boolean): boolean;
export declare const attachmentFolders: () => string[];
export declare function wordsOf(): {
    case: string;
    cases: string;
    customer: string;
};
