import {
    Table,
    Column,
    Model,
    AllowNull,
    Default,
    PrimaryKey,
    AutoIncrement,
    CreatedAt,
    UpdatedAt,
    DataType,
    Index,
} from 'etherial/components/database/provider'

import type { FlowGraph } from '../types.js'

/**
 * One automation, as the customer built it.
 *
 * Unlike the ETHPulseLeaf models, this one ships with its `@Table` and is
 * registered by the leaf itself: it has no foreign key into the project's own
 * schema — `created_by_user_id` is a plain integer, deliberately not an
 * association — so there is nothing for a project to extend, and asking every
 * project to redeclare three tables to get automations would be a poor trade.
 */
@Table({
    timestamps: true,
    tableName: 'flows',
    freezeTableName: true,
})
export class Flow extends Model<Flow> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    declare id: number

    @AllowNull(false)
    @Column
    declare name: string

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare description: string

    /**
     * Off by default. A flow is written over several sittings, and a
     * half-drawn graph that starts sending emails the moment it is saved is the
     * kind of surprise that makes people stop trusting the feature.
     */
    @AllowNull(false)
    @Default(false)
    @Index
    @Column
    declare enabled: boolean

    /** Registered trigger id, e.g. `model.appointments.created`. */
    @AllowNull(false)
    @Index
    @Column
    declare trigger_id: string

    @AllowNull(true)
    @Column(DataType.JSON)
    declare trigger_config: Record<string, any>

    @AllowNull(true)
    @Column(DataType.JSON)
    declare graph: FlowGraph

    /**
     * Secret half of this flow's inbound URL, for `webhook.received`. Generated
     * on demand rather than for every flow — an unused URL that answers is an
     * unused URL that can be found.
     */
    @AllowNull(true)
    @Index
    @Column
    declare webhook_token: string

    @AllowNull(true)
    @Column
    declare created_by_user_id: number

    @AllowNull(true)
    @Column
    declare last_run_at: Date

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare last_error: string

    @AllowNull(false)
    @Default(0)
    @Column
    declare run_count: number

    @AllowNull(false)
    @Default(0)
    @Column
    declare error_count: number

    /**
     * When the ticker last looked at this flow. Only meaningful for the pulled
     * kinds (`schedule`, `query`); it is what keeps a restart mid-minute from
     * firing an hourly flow twice.
     */
    @AllowNull(true)
    @Column
    declare last_tick_at: Date

    @AllowNull(true)
    @Column
    declare deleted_at: Date

    @CreatedAt
    declare created_at: Date

    @UpdatedAt
    declare updated_at: Date
}
