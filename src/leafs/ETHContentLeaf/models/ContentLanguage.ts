import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, BeforeValidate, BeforeSave, AfterSave, BeforeDestroy, AfterDestroy } from 'etherial/components/database/provider'

import { missingIn, relabel } from '../services/coverage.js'
import { ContentError, isLocale, languageName, nativeName, rtlOf } from '../services/options.js'
import { state } from '../services/state.js'

/** `a, b and c`. */
const listOf = (parts: string[]) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0])

/** After the save's transaction, if any: read before, the languages would miss it. */
function afterCommit(transaction: Transaction | null | undefined, run: () => Promise<void>) {
    if (transaction) transaction.afterCommit(() => run().catch((err) => console.error('[ETHContentLeaf] The languages could not be read again:', err)))
    else return run()
}

/**
 * A language the contents are written in (Content › Languages): its fields
 * in every form of the back-office, and in the app once `published`. One is
 * the default: what a text missing in another language falls back to, so
 * every content needs it. A language removed leaves its texts in place.
 */
@Table({
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'content_languages',
    freezeTableName: true,
    // An index, not a unique column: the alter-sync adds a unique constraint again on every boot.
    indexes: [{ name: 'content_languages_code_unique', unique: true, fields: ['code'] }],
})
export class ContentLanguage extends Model<ContentLanguage> {
    @AutoIncrement
    @PrimaryKey
    @Column(DataType.INTEGER)
    declare id: number

    /** `fr`: the key of its texts in every content. It can't change. */
    @AllowNull(false)
    @Column(DataType.STRING(10))
    declare code: string

    /** `Français`, as the app's language picker shows it. Empty: its own name. */
    @AllowNull(false)
    @Default('')
    @Column(DataType.STRING(40))
    declare name: string

    /** Written right to left. Empty: as `rtlLocales` says (Arabic, Hebrew, Persian, Urdu). */
    @AllowNull(true)
    @Column(DataType.BOOLEAN)
    declare rtl: boolean | null

    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    declare is_default: boolean

    /** In the app. Off: in the back-office only, while it is being translated. The default always is. */
    @AllowNull(false)
    @Default(false)
    @Column(DataType.BOOLEAN)
    declare published: boolean

    declare created_at: Date
    declare updated_at: Date

    /** The previous default, when this one takes its place: for `switched`. */
    declare becomesDefault?: boolean

    /** The languages to the running leaf, the default first. */
    static async load(): Promise<void> {
        const rows = await ContentLanguage.findAll({ order: [['id', 'ASC']] })
        const fallback = rows.find((r) => r.is_default) ?? rows[0]
        if (!fallback) state.languages = null
        else {
            const ordered = [fallback, ...rows.filter((r) => r !== fallback)]
            state.languages = {
                all: ordered.map((r) => r.code),
                app: ordered.filter((r) => r === fallback || r.published).map((r) => r.code),
                default: fallback.code,
                rtl: ordered.filter((r) => r.rtl).map((r) => r.code),
                names: Object.fromEntries(ordered.map((r) => [r.code, r.name || nativeName(r.code)])),
            }
        }
        for (const listener of state.onLanguages) listener()
    }

    /** Sequelize checks NOT NULL before `check` runs: a name left empty waits for it as ''. */
    @BeforeValidate
    static emptyName(language: ContentLanguage) {
        if (language.name == null) language.name = ''
    }

    @BeforeSave
    static async check(language: ContentLanguage, options: { transaction?: Transaction | null }) {
        const transaction = options.transaction ?? undefined
        language.code = String(language.code ?? '')
            .trim()
            .toLowerCase()
        if (!isLocale(language.code)) throw new ContentError('Language: its code, two or three letters (fr, es).')
        if (!language.isNewRecord && language.changed('code')) {
            throw new ContentError("A language's code can't change: add the other language, then remove this one.")
        }
        const name = languageName(language.code)
        language.name = String(language.name ?? '').trim() || nativeName(language.code)
        if (language.rtl === null || language.rtl === undefined) language.rtl = rtlOf(state.config, language.code)

        const others = { ...(language.id ? { id: { [Op.ne]: language.id } } : {}) }
        if (await ContentLanguage.findOne({ where: { ...others, code: language.code }, attributes: ['id'], transaction })) {
            throw new ContentError(`${name} is already listed.`)
        }
        const current = await ContentLanguage.findOne({ where: { ...others, is_default: true }, attributes: ['id'], transaction })
        const wasDefault = !language.isNewRecord && !!language.previous('is_default')

        if (!language.is_default && !current) {
            if (wasDefault) throw new ContentError(`${name} is the default language: make another one the default instead.`)
            // The first language is the default.
            language.is_default = true
        }
        if (language.is_default && current) {
            // Every content needs its text in the default language: refused while one has none.
            const missing = await missingIn(language.code)
            if (missing.length) {
                throw new ContentError(
                    `${name} can't be the default language yet: ${listOf(missing.map((m) => `${m.count} ${m.what}`))} have no ${name} text. Write them first, then try again.`
                )
            }
            language.becomesDefault = true
        }
        if (language.is_default && !language.published) {
            if (wasDefault && language.changed('published')) throw new ContentError(`${name} is the default language: the app always gets it.`)
            language.published = true
        }
    }

    /** The previous default no longer is; the back-office's titles follow the new one. Then the languages are read again. */
    @AfterSave
    static async switched(language: ContentLanguage, options: { transaction?: Transaction | null }) {
        if (language.becomesDefault) {
            language.becomesDefault = false
            await ContentLanguage.update(
                { is_default: false },
                { where: { id: { [Op.ne]: language.id }, is_default: true }, hooks: false, transaction: options.transaction ?? undefined }
            )
            await relabel(language.code, options.transaction ?? undefined)
        }
        await afterCommit(options.transaction, () => ContentLanguage.load())
    }

    @BeforeDestroy
    static keepDefault(language: ContentLanguage) {
        if (language.is_default) throw new ContentError(`${languageName(language.code)} is the default language: make another one the default first.`)
    }

    @AfterDestroy
    static async removed(_language: ContentLanguage, options: { transaction?: Transaction | null }) {
        await afterCommit(options.transaction, () => ContentLanguage.load())
    }
}
