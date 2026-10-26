import type { Transaction } from 'sequelize'

import { Contact } from '../models/Contact.js'
import { ContentLanguage } from '../models/ContentLanguage.js'
import { FaqQuestion } from '../models/FaqQuestion.js'
import { FaqSection } from '../models/FaqSection.js'
import { LegalDocument } from '../models/LegalDocument.js'
import { Office } from '../models/Office.js'
import { ETHContentLeafConfig, featuresOf, labelOf, languagesOf, localizedOf } from './options.js'
import { languages } from './state.js'

/**
 * Writes a table's first rows, once: while its id sequence has never been
 * used. A table the team emptied stays empty, and two servers booting
 * together write it once (the lock). Postgres only, else while it is empty.
 */
async function once(Model: any, write: (transaction: Transaction) => Promise<void>): Promise<boolean> {
    const sequelize = Model.sequelize
    const table = String(Model.getTableName())
    return sequelize.transaction(async (transaction: Transaction) => {
        if (sequelize.getDialect() !== 'postgres') {
            if (await Model.count({ transaction })) return false
        } else {
            await sequelize.query(`LOCK TABLE "${table}" IN SHARE ROW EXCLUSIVE MODE`, { transaction })
            const [[found]] = await sequelize.query(`SELECT pg_get_serial_sequence(:table, 'id') AS seq`, { replacements: { table }, transaction })
            if (!found?.seq) return false
            const [[sequence]] = await sequelize.query(`SELECT is_called FROM ${found.seq}`, { transaction })
            if (sequence.is_called) return false
        }
        await write(transaction)
        return true
    })
}

/** The config's `locales`, into Content › Languages, once: the team adds and removes them from then on. */
export async function seedLanguages(config: ETHContentLeafConfig): Promise<string[]> {
    const { all, app, rtl } = languagesOf(config)
    const done = await once(ContentLanguage, async (transaction) => {
        for (const [i, code] of all.entries()) {
            await ContentLanguage.create({ code, is_default: i === 0, published: app.includes(code), rtl: rtl.includes(code) } as any, { transaction })
        }
    })
    return done ? [`${all.length} languages`] : []
}

/** The config's `seed`, into the tables that have never had a row. Returns what was written. */
export async function seedContent(config: ETHContentLeafConfig): Promise<string[]> {
    const seed = config.seed
    if (!seed) return []
    const features = featuresOf(config)
    const fallback = languages().default
    const text = (value: any) => localizedOf(value, fallback)
    const written: string[] = []

    if (features.includes('faq') && seed.faq?.length) {
        const done = await once(FaqSection, async (transaction) => {
            for (const [s, section] of seed.faq!.entries()) {
                const row = await FaqSection.create({ title: text(section.title), position: s } as any, { transaction })
                for (const [q, item] of section.questions.entries()) {
                    await FaqQuestion.create({ section_id: row.id, question: text(item.question), answer: text(item.answer), position: q } as any, { transaction })
                }
            }
        })
        if (done) written.push(`${seed.faq.length} FAQ sections`)
    }

    if (features.includes('contacts') && seed.contacts?.length) {
        const done = await once(Contact, async (transaction) => {
            for (const [i, c] of seed.contacts!.entries()) {
                await Contact.create({ kind: c.kind, value: c.value, label: text(c.label), hours: text(c.hours), position: i } as any, { transaction })
            }
        })
        if (done) written.push(`${seed.contacts.length} contacts`)
    }

    if (features.includes('contacts') && seed.offices?.length) {
        const done = await once(Office, async (transaction) => {
            for (const [i, o] of seed.offices!.entries()) {
                await Office.create(
                    {
                        name: text(o.name),
                        address: text(o.address),
                        hours: text(o.hours),
                        phone: o.phone ?? null,
                        email: o.email ?? null,
                        latitude: o.latitude ?? null,
                        longitude: o.longitude ?? null,
                        map_url: o.map_url ?? null,
                        position: i,
                    } as any,
                    { transaction }
                )
            }
        })
        if (done) written.push(`${seed.offices.length} offices`)
    }

    if (features.includes('legal') && seed.legal?.length) {
        const done = await once(LegalDocument, async (transaction) => {
            for (const [i, d] of seed.legal!.entries()) {
                const body = text(d.body)
                const url = text(d.url)
                await LegalDocument.create(
                    {
                        slug: d.slug,
                        title: text(d.title),
                        body,
                        url,
                        version: d.version ?? null,
                        // Published when there is something to read.
                        published: !!(labelOf(body, fallback) || labelOf(url, fallback)),
                        position: i,
                    } as any,
                    { transaction }
                )
            }
        })
        if (done) written.push(`${seed.legal.length} legal documents`)
    }

    return written
}
