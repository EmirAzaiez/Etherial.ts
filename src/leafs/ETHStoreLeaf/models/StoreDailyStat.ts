import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default } from 'etherial/components/database/provider'

/**
 * One store, one day, one country — or every country together when `country`
 * is empty. Every figure is the store's own report (null when that store
 * does not give it), except Apple's rating: the public one, read that day.
 * The countries rows hold the downloads only; the rest is on the
 * all-countries row.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'store_daily_stats',
    freezeTableName: true,
    indexes: [
        { unique: true, fields: ['store', 'date', 'country'] },
        { fields: ['date', 'country'] },
    ],
})
export class StoreDailyStat extends Model<StoreDailyStat> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** `apple` or `google`. */
    @AllowNull(false)
    @Column(DataType.STRING(16))
    declare store: string

    /** The day as the store reports it. */
    @AllowNull(false)
    @Column(DataType.DATEONLY)
    declare date: string

    /** Two letters (`SA`), or empty for every country together. */
    @AllowNull(false)
    @Default('')
    @Column(DataType.STRING(2))
    declare country: string

    /** First installs: Apple's first downloads, Google's new users. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare downloads: number | null

    /** Installed again by someone who had it: Apple's re-downloads, Google's other installs. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare redownloads: number | null

    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare updates: number | null

    /** Google: people who removed it from all their devices. Apple: deletions, of the people who share their data only. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare uninstalls: number | null

    /** Google only: devices that have it installed that day. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare active_devices: number | null

    /** Apple: its public rating, read that day. Google: the average of every rating given up to that day. */
    @AllowNull(true)
    @Column(DataType.DOUBLE)
    declare rating_average: number | null

    /** Apple only: how many have rated it, from the public page. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare ratings_count: number | null

    /** Apple only: the app's icon seen in a list (search results, charts, Today). */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare impressions: number | null

    /** Apple: product page views. Google: store listing visitors. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare page_views: number | null

    /** Of them, the first downloads from that page: Apple's from the product page, Google's store listing acquisitions. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare acquisitions: number | null

    /** Apple only, of the people who share their data: how often the app was opened. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare sessions: number | null

    /** The sessions' length together, in seconds. */
    @AllowNull(true)
    @Column(DataType.DOUBLE)
    declare session_seconds: number | null

    /** The devices the sessions came from. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare session_devices: number | null

    /** Apple: of the people who share their data only. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare crashes: number | null

    /** Google only: "Application Not Responding", the app frozen long enough for Android to offer to close it. */
    @AllowNull(true)
    @Column(DataType.INTEGER)
    declare anrs: number | null

    /** The first downloads by where they came from: `{ "search": 12, "browse": 3 }`. */
    @AllowNull(true)
    @Column(DataType.JSON)
    declare sources: Record<string, number> | null
}
