import { Model } from 'etherial/components/database/provider';
/**
 * Base SchedulerWindowHost (no @Table): one agent holding one window. The
 * windows are the only source of agents: a window without anyone offers no slot.
 *
 * The project adds both foreign keys, `window` and `agent`, and a unique index
 * on the pair.
 */
export declare class BaseSchedulerWindowHost extends Model<any> {
    id: number;
    scheduler_window_id: number;
    agent_id: number;
    created_at: Date;
    updated_at: Date;
}
