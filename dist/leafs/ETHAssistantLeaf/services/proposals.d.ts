import type { ToolDefinition } from './anthropic.js';
import type { ReadableCollection } from './catalog.js';
import { Step, ToolContext } from './tools.js';
export type ProposalKind = 'update' | 'create' | 'action' | 'bulk_update';
export interface ProposalChange {
    field: string;
    label: string;
    /** As the back-office shows it: a choice's label, a linked record's name. Null when empty (and on a create or an action). */
    before: string | null;
    after: string | null;
}
/** One change waiting for the staff member's decision (contract C7). */
export interface Proposal {
    id: string;
    kind: ProposalKind;
    collection: string;
    recordId?: string | number;
    recordIds?: (string | number)[];
    action?: string;
    /** What confirming sends: the fields to set, or the action's form. */
    data?: Record<string, unknown>;
    diff?: ProposalChange[];
    summary: string;
    /** "Edit Booking #12": what the card is headed with. */
    title: string;
    collectionLabel: string;
    actionLabel?: string;
    /** A destructive action: the card's button says so. */
    tone?: 'default' | 'danger';
    /** The records touched, named, for an action or a bulk edit. */
    records?: {
        id: string | number;
        label: string;
    }[];
    /** The record's page. */
    link?: string;
    /**
     * Record id → when it was last written, as the proposal read it. Confirm
     * sends it as `If-Match`: a record someone changed since is refused (409)
     * rather than overwritten with a diff that no longer holds.
     */
    versions?: Record<string, string>;
}
export declare const PROPOSAL_TOOLS: ToolDefinition[];
export declare const isProposalTool: (name: string) => boolean;
/** What describe_collection adds when proposals are on: what this person may prepare there. */
export declare function writableSide(collection: ReadableCollection, context: ToolContext): Promise<{
    can_prepare?: undefined;
} | {
    can_prepare: {
        actions?: {
            key: string;
            label: string;
            form?: string[];
        }[];
        settable_fields?: string[];
        edit: boolean;
        create: boolean;
    };
}>;
export declare function runProposal(name: string, input: any, context: ToolContext): Promise<{
    result: unknown;
    step: Step;
}>;
