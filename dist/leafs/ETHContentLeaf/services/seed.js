var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Contact } from '../models/Contact.js';
import { ContentLanguage } from '../models/ContentLanguage.js';
import { FaqQuestion } from '../models/FaqQuestion.js';
import { FaqSection } from '../models/FaqSection.js';
import { LegalDocument } from '../models/LegalDocument.js';
import { Office } from '../models/Office.js';
import { featuresOf, labelOf, languagesOf, localizedOf } from './options.js';
import { languages } from './state.js';
/**
 * Writes a table's first rows, once: while its id sequence has never been
 * used. A table the team emptied stays empty, and two servers booting
 * together write it once (the lock). Postgres only, else while it is empty.
 */
function once(Model, write) {
    return __awaiter(this, void 0, void 0, function* () {
        const sequelize = Model.sequelize;
        const table = String(Model.getTableName());
        return sequelize.transaction((transaction) => __awaiter(this, void 0, void 0, function* () {
            if (sequelize.getDialect() !== 'postgres') {
                if (yield Model.count({ transaction }))
                    return false;
            }
            else {
                yield sequelize.query(`LOCK TABLE "${table}" IN SHARE ROW EXCLUSIVE MODE`, { transaction });
                const [[found]] = yield sequelize.query(`SELECT pg_get_serial_sequence(:table, 'id') AS seq`, { replacements: { table }, transaction });
                if (!(found === null || found === void 0 ? void 0 : found.seq))
                    return false;
                const [[sequence]] = yield sequelize.query(`SELECT is_called FROM ${found.seq}`, { transaction });
                if (sequence.is_called)
                    return false;
            }
            yield write(transaction);
            return true;
        }));
    });
}
/** The config's `locales`, into Content › Languages, once: the team adds and removes them from then on. */
export function seedLanguages(config) {
    return __awaiter(this, void 0, void 0, function* () {
        const { all, app, rtl } = languagesOf(config);
        const done = yield once(ContentLanguage, (transaction) => __awaiter(this, void 0, void 0, function* () {
            for (const [i, code] of all.entries()) {
                yield ContentLanguage.create({ code, is_default: i === 0, published: app.includes(code), rtl: rtl.includes(code) }, { transaction });
            }
        }));
        return done ? [`${all.length} languages`] : [];
    });
}
/** The config's `seed`, into the tables that have never had a row. Returns what was written. */
export function seedContent(config) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const seed = config.seed;
        if (!seed)
            return [];
        const features = featuresOf(config);
        const fallback = languages().default;
        const text = (value) => localizedOf(value, fallback);
        const written = [];
        if (features.includes('faq') && ((_a = seed.faq) === null || _a === void 0 ? void 0 : _a.length)) {
            const done = yield once(FaqSection, (transaction) => __awaiter(this, void 0, void 0, function* () {
                for (const [s, section] of seed.faq.entries()) {
                    const row = yield FaqSection.create({ title: text(section.title), position: s }, { transaction });
                    for (const [q, item] of section.questions.entries()) {
                        yield FaqQuestion.create({ section_id: row.id, question: text(item.question), answer: text(item.answer), position: q }, { transaction });
                    }
                }
            }));
            if (done)
                written.push(`${seed.faq.length} FAQ sections`);
        }
        if (features.includes('contacts') && ((_b = seed.contacts) === null || _b === void 0 ? void 0 : _b.length)) {
            const done = yield once(Contact, (transaction) => __awaiter(this, void 0, void 0, function* () {
                for (const [i, c] of seed.contacts.entries()) {
                    yield Contact.create({ kind: c.kind, value: c.value, label: text(c.label), hours: text(c.hours), position: i }, { transaction });
                }
            }));
            if (done)
                written.push(`${seed.contacts.length} contacts`);
        }
        if (features.includes('contacts') && ((_c = seed.offices) === null || _c === void 0 ? void 0 : _c.length)) {
            const done = yield once(Office, (transaction) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c, _d, _e;
                for (const [i, o] of seed.offices.entries()) {
                    yield Office.create({
                        name: text(o.name),
                        address: text(o.address),
                        hours: text(o.hours),
                        phone: (_a = o.phone) !== null && _a !== void 0 ? _a : null,
                        email: (_b = o.email) !== null && _b !== void 0 ? _b : null,
                        latitude: (_c = o.latitude) !== null && _c !== void 0 ? _c : null,
                        longitude: (_d = o.longitude) !== null && _d !== void 0 ? _d : null,
                        map_url: (_e = o.map_url) !== null && _e !== void 0 ? _e : null,
                        position: i,
                    }, { transaction });
                }
            }));
            if (done)
                written.push(`${seed.offices.length} offices`);
        }
        if (features.includes('legal') && ((_d = seed.legal) === null || _d === void 0 ? void 0 : _d.length)) {
            const done = yield once(LegalDocument, (transaction) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                for (const [i, d] of seed.legal.entries()) {
                    const body = text(d.body);
                    const url = text(d.url);
                    yield LegalDocument.create({
                        slug: d.slug,
                        title: text(d.title),
                        body,
                        url,
                        version: (_a = d.version) !== null && _a !== void 0 ? _a : null,
                        // Published when there is something to read.
                        published: !!(labelOf(body, fallback) || labelOf(url, fallback)),
                        position: i,
                    }, { transaction });
                }
            }));
            if (done)
                written.push(`${seed.legal.length} legal documents`);
        }
        return written;
    });
}
