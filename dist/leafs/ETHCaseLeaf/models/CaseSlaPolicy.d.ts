import { Model } from 'etherial/components/database/provider';
/**
 * How fast a case must be answered and resolved, in hours from its opening
 * (calendar hours, nights and weekends included). The most specific active
 * policy wins: one naming kind, category and priority beats one naming only
 * the priority; a policy naming none of them is the default.
 */
export declare class CaseSlaPolicy extends Model<CaseSlaPolicy> {
    id: number;
    label: string;
    kind: string | null;
    category: string | null;
    priority: string | null;
    /** Hours to the first staff reply; null for no target. */
    first_response_hours: number | null;
    /** Hours to the resolution; null for no target. */
    resolution_hours: number | null;
    active: boolean;
    created_at: Date;
    updated_at: Date;
    /** The cases opened next use the change at once, on this server. */
    static forget(): void;
}
