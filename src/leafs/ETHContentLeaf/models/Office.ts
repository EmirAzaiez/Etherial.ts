import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, BeforeSave } from 'etherial/components/database/provider'

import { cleanTexts, orNull, requiredLabel } from '../services/texts.js'

/** An office or a sales center: where it is, when it opens, how to call it. */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'content_offices',
    freezeTableName: true,
    indexes: [{ fields: ['published', 'position'] }],
})
export class Office extends Model<Office> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** `{ en: 'Dubai Sales Center' }` */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare name: Record<string, string>

    /** The name in the default language: the back-office's lists and search. Written by the leaf. */
    @AllowNull(false)
    @Default('')
    @Column(DataType.STRING(200))
    declare label: string

    /** `{ en: 'Building 3, …' }`, on several lines if need be. */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare address: Record<string, string>

    @AllowNull(true)
    @Column(DataType.STRING(40))
    declare phone: string | null

    @AllowNull(true)
    @Column(DataType.STRING(200))
    declare email: string | null

    /** `{ en: 'Sun–Thu, 9:00–17:00' }`, in words. */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare hours: Record<string, string>

    @AllowNull(true)
    @Column(DataType.DOUBLE)
    declare latitude: number | null

    @AllowNull(true)
    @Column(DataType.DOUBLE)
    declare longitude: number | null

    /** A Google Maps link. Empty: the app's is made from the pin. */
    @AllowNull(true)
    @Column(DataType.STRING(500))
    declare map_url: string | null

    @AllowNull(false)
    @Default(0)
    @Column(DataType.INTEGER)
    declare position: number

    @AllowNull(false)
    @Default(true)
    @Column(DataType.BOOLEAN)
    declare published: boolean

    declare created_at: Date
    declare updated_at: Date

    @BeforeSave
    static fillLabel(office: Office) {
        office.name = cleanTexts(office.name)
        office.address = cleanTexts(office.address)
        office.hours = cleanTexts(office.hours)
        office.label = requiredLabel(office.name, 'Name')
        office.phone = orNull(office.phone)
        office.email = orNull(office.email)
        office.map_url = orNull(office.map_url)
    }
}
