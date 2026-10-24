import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Default } from 'etherial/components/database/provider'

/**
 * Base Agent (no @Table): an employee who receives customers. Not a user of
 * the app: an agent may have no account, and an account may stop being one.
 *
 * The project adds `appointments`, `holidays` (its blocks, `foreignKey:
 * 'agent_id'`) and, if it links agents to its users, `user_id`.
 */
export class BaseAgent extends Model<any> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column(DataType.INTEGER)
    id: number

    @AllowNull(true)
    @Column(DataType.STRING)
    first_name: string

    @AllowNull(true)
    @Column(DataType.STRING)
    last_name: string

    @AllowNull(true)
    @Column(DataType.STRING)
    email: string

    @AllowNull(true)
    @Column(DataType.STRING)
    phone_number: string

    /** Off: kept for the history, offers no more slots. */
    @AllowNull(false)
    @Default(true)
    @Column(DataType.BOOLEAN)
    active: boolean

    /** Customers received at once: a show flat takes several, a handover one. */
    @AllowNull(false)
    @Default(1)
    @Column(DataType.INTEGER)
    max_concurrent_appointments: number

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date
}
