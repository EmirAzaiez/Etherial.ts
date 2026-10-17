import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default } from 'etherial/components/database/provider'

/**
 * One question put to one person: asked, then answered, dismissed or left to
 * expire. The row exists from the moment the person is invited, so the
 * back-office can tell how many of those asked answered.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'survey_responses',
    freezeTableName: true,
    indexes: [
        { fields: ['survey', 'answered_at'] },
        { fields: ['user_id', 'status'] },
        { fields: ['user_id', 'created_at'] },
        { fields: ['status', 'available_at'] },
        // One question per person and per thing that happened.
        { unique: true, fields: ['survey', 'user_id', 'subject_type', 'subject_id'] },
    ],
})
export class SurveyResponse extends Model<SurveyResponse> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** The survey's key, from the project's config. */
    @AllowNull(false)
    @Column(DataType.STRING(64))
    declare survey: string

    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare user_id: number

    /** What prompted the question: the model and row a trigger saw. */
    @AllowNull(false)
    @Default('')
    @Column(DataType.STRING(64))
    declare subject_type: string

    @AllowNull(false)
    @Default('')
    @Column(DataType.STRING(64))
    declare subject_id: string

    @AllowNull(true)
    @Column(DataType.STRING(255))
    declare subject_label: string | null

    /** pending, answered, dismissed, expired. */
    @AllowNull(false)
    @Default('pending')
    @Column(DataType.STRING(16))
    declare status: string

    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare score: number | null

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare comment: string | null

    /** The language the question was read in. */
    @AllowNull(true)
    @Column(DataType.STRING(16))
    declare locale: string | null

    @AllowNull(true)
    @Column(DataType.STRING(16))
    declare platform: string | null

    @AllowNull(true)
    @Column(DataType.STRING(32))
    declare app_version: string | null

    /** The question opens then: what happened plus the survey's delay. */
    @AllowNull(false)
    @Column(DataType.DATE)
    declare available_at: Date

    @AllowNull(false)
    @Column(DataType.DATE)
    declare expires_at: Date

    @AllowNull(true)
    @Column(DataType.DATE)
    declare notified_at: Date | null

    @AllowNull(true)
    @Column(DataType.DATE)
    declare answered_at: Date | null

    declare created_at: Date
    declare updated_at: Date
}
