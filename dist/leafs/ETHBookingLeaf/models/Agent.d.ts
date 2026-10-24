import { Model } from 'etherial/components/database/provider';
/**
 * Base Agent (no @Table): an employee who receives customers. Not a user of
 * the app: an agent may have no account, and an account may stop being one.
 *
 * The project adds `appointments`, `holidays` (its blocks, `foreignKey:
 * 'agent_id'`) and, if it links agents to its users, `user_id`.
 */
export declare class BaseAgent extends Model<any> {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    /** Off: kept for the history, offers no more slots. */
    active: boolean;
    /** Customers received at once: a show flat takes several, a handover one. */
    max_concurrent_appointments: number;
    created_at: Date;
    updated_at: Date;
}
