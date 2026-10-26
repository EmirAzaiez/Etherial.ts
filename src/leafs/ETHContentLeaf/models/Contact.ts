import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, BeforeSave } from 'etherial/components/database/provider'

import { CONTACT_KINDS, ContactKind, ContentError } from '../services/options.js'
import { cleanTexts } from '../services/texts.js'

/** One way to reach the company: a phone number, a WhatsApp, an email address, a site, a social account. */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'content_contacts',
    freezeTableName: true,
    indexes: [{ fields: ['published', 'position'] }],
})
export class Contact extends Model<Contact> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** `phone`, `whatsapp`, `email`, `website`, `instagram`… (CONTACT_KINDS). The app picks its icon from it. */
    @AllowNull(false)
    @Column(DataType.STRING(20))
    declare kind: ContactKind

    /** `+971 4 123 4567`, `care@example.com`, `https://instagram.com/…`. The app's link is made from it. */
    @AllowNull(false)
    @Column(DataType.STRING(300))
    declare value: string

    /** `{ en: 'Customer care' }`. Empty: the app names it after its kind. */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare label: Record<string, string>

    /** `{ en: 'Sun–Thu, 9:00–17:00' }`, in words. */
    @AllowNull(false)
    @Default({})
    @Column(DataType.JSONB)
    declare hours: Record<string, string>

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
    static check(contact: Contact) {
        if (!CONTACT_KINDS.includes(contact.kind)) throw new ContentError(`Kind: one of ${CONTACT_KINDS.join(', ')}.`)
        contact.value = String(contact.value ?? '').trim()
        if (!contact.value) throw new ContentError('Value: the number, the address or the link is required.')
        contact.label = cleanTexts(contact.label)
        contact.hours = cleanTexts(contact.hours)
    }
}
