import { Model } from 'etherial/components/database/provider';
/**
 * A reply staff pick instead of typing it again. `{{customer_name}}`,
 * `{{reference}}`, `{{subject}}` and `{{staff_name}}` are filled in for the
 * case it is used on. Without a kind, it is offered on every case.
 */
export declare class CaseCannedReply extends Model<CaseCannedReply> {
    id: number;
    title: string;
    body: string;
    /** Offered on the cases of this kind only; null for all. */
    kind: string | null;
    active: boolean;
    /** How many replies were sent from it: the list puts the most used first. */
    used_count: number;
    created_at: Date;
    updated_at: Date;
}
