import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType } from 'etherial/components/database/provider'

/**
 * A written review, as the store's own report gives it: App Store Connect's
 * customer reviews, Google Play's monthly reviews file. Read again while it
 * is recent: the author may edit it, the developer reply to it.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'store_reviews',
    freezeTableName: true,
    indexes: [
        { unique: true, fields: ['store', 'review_id'] },
        { fields: ['written_at'] },
    ],
})
export class StoreReview extends Model<StoreReview> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** `apple` or `google`. */
    @AllowNull(false)
    @Column(DataType.STRING(16))
    declare store: string

    /** The store's own id for it. */
    @AllowNull(false)
    @Column(DataType.STRING(255))
    declare review_id: string

    /** 1 to 5. */
    @AllowNull(false)
    @Column(DataType.INTEGER)
    declare rating: number

    /** Apple only: Google's reviews have no title. */
    @AllowNull(true)
    @Column(DataType.TEXT)
    declare title: string | null

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare body: string | null

    /** Apple only: the nickname the author chose. */
    @AllowNull(true)
    @Column(DataType.STRING(255))
    declare author: string | null

    /** Apple: the storefront, in two letters (`SA`). */
    @AllowNull(true)
    @Column(DataType.STRING(8))
    declare territory: string | null

    /** Google: the author's language (`ar`). */
    @AllowNull(true)
    @Column(DataType.STRING(16))
    declare language: string | null

    /** Google: the version the author had. */
    @AllowNull(true)
    @Column(DataType.STRING(64))
    declare version: string | null

    /** Google: the author's phone. */
    @AllowNull(true)
    @Column(DataType.STRING(128))
    declare device: string | null

    @AllowNull(false)
    @Column(DataType.DATE)
    declare written_at: Date

    /** The developer's answer, as published (Apple also gives one still waiting to be). */
    @AllowNull(true)
    @Column(DataType.TEXT)
    declare reply: string | null

    @AllowNull(true)
    @Column(DataType.DATE)
    declare replied_at: Date | null

    /** Google: the review in Play Console. */
    @AllowNull(true)
    @Column(DataType.STRING(1024))
    declare url: string | null
}
