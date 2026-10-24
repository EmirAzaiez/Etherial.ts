import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, AfterSave, AfterDestroy } from 'etherial/components/database/provider'

import { forgetSlaPolicies } from '../services/sla.js'

/**
 * How fast a case must be answered and resolved, in hours from its opening
 * (calendar hours, nights and weekends included). The most specific active
 * policy wins: one naming kind, category and priority beats one naming only
 * the priority; a policy naming none of them is the default.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'case_sla_policies',
    freezeTableName: true,
})
export class CaseSlaPolicy extends Model<CaseSlaPolicy> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    @AllowNull(false)
    @Column(DataType.STRING(120))
    declare label: string

    @AllowNull(true)
    @Column(DataType.STRING(64))
    declare kind: string | null

    @AllowNull(true)
    @Column(DataType.STRING(64))
    declare category: string | null

    @AllowNull(true)
    @Column(DataType.STRING(64))
    declare priority: string | null

    /** Hours to the first staff reply; null for no target. */
    @AllowNull(true)
    @Column(DataType.FLOAT)
    declare first_response_hours: number | null

    /** Hours to the resolution; null for no target. */
    @AllowNull(true)
    @Column(DataType.FLOAT)
    declare resolution_hours: number | null

    @AllowNull(false)
    @Default(true)
    @Column(DataType.BOOLEAN)
    declare active: boolean

    declare created_at: Date
    declare updated_at: Date

    /** The cases opened next use the change at once, on this server. */
    @AfterSave
    @AfterDestroy
    static forget() {
        forgetSlaPolicies()
    }
}
