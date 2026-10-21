import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default } from 'etherial/components/database/provider'

import type { SurveyQuestion, SurveyTargetOption } from '../services/options.js'

/**
 * A survey, written in the back-office: its questions, and when it is asked —
 * after which event of the project, narrowed or not to some of its values (the
 * bookings of a scheduler, the tickets of a type).
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'survey_forms',
    freezeTableName: true,
    // An index, not a unique column: the alter-sync adds a unique constraint again on every boot.
    indexes: [{ unique: true, fields: ['key'] }, { fields: ['event', 'active'] }],
})
export class SurveyForm extends Model<SurveyForm> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** Stored with every answer (`survey_responses.survey`): set once, from the title. */
    @AllowNull(false)
    @Column(DataType.STRING(64))
    declare key: string

    @AllowNull(false)
    @Column(DataType.STRING(255))
    declare title: string

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare description: string | null

    /** Off: nobody is asked any more, and the questions still waiting are no longer shown. */
    @AllowNull(false)
    @Default(true)
    @Column(DataType.BOOLEAN)
    declare active: boolean

    /** The project's event it is asked after (`config.events[].key`). */
    @AllowNull(true)
    @Column(DataType.STRING(64))
    declare event: string | null

    /** The event's values it is narrowed to, with their label when chosen. Empty: every one. */
    @AllowNull(false)
    @Default([])
    @Column(DataType.JSONB)
    declare targets: SurveyTargetOption[]

    @AllowNull(false)
    @Default([])
    @Column(DataType.JSONB)
    declare questions: SurveyQuestion[]

    /** Minutes between the event and the question: let the visit end first. */
    @AllowNull(false)
    @Default(60)
    @Column(DataType.INTEGER)
    declare delay_minutes: number

    /** Days the question stays open before it is dropped. */
    @AllowNull(false)
    @Default(7)
    @Column(DataType.INTEGER)
    declare expires_after_days: number

    declare created_at: Date
    declare updated_at: Date
}
