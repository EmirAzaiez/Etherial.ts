var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { randomUUID } from 'crypto';
import { Op, col, fn } from 'sequelize';
import { MailCampaign } from '../models/MailCampaign.js';
import { MailCampaignRecipient } from '../models/MailCampaignRecipient.js';
import { MailUnsubscribe } from '../models/MailUnsubscribe.js';
import { normalizeBlocks, normalizeLine, placeholdersOf } from './blocks.js';
import { peopleNames, person } from './people.js';
import { state } from './state.js';
import { checkLocale, pulse, renderVersion, resolveLocale } from './templates.js';
import { activeTheme } from './theme.js';
import { isUnsubscribed, unsubscribeNotice, unsubscribeUrl, unsubscribedAmong } from './unsubscribe.js';
import { MailError, isRtl, localesOf, variablesOf } from './options.js';
// ──────────────────────────────────────────────────────────────────────────
// Campaigns: an email written in the back-office, in each language, sent once
// to one of the project's audiences. When it is due, its recipients are listed
// (one row per address, so listing again never doubles one), then a sweep sends
// them in small batches. A batch takes its rows atomically: two servers never
// send the same email. A row a stopped server left half-sent is marked failed,
// never sent again: it may have left.
// ──────────────────────────────────────────────────────────────────────────
const SWEEP_MS = 20000;
/** A campaign listing its recipients this long was left by a stopped server: listed again. */
const PREPARE_STALE_MS = 10 * 60000;
/** A row taken by a batch this long ago was left by a stopped server: failed. */
const SENDING_STALE_MS = 30 * 60000;
const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
const EDITABLE = ['draft'];
const DELETABLE = ['draft', 'cancelled', 'failed', 'sent'];
function config() {
    const campaigns = state.config.campaigns;
    if (!campaigns)
        throw new MailError('campaigns_off', 404, 'Campaigns are not set up: add `campaigns` to the mail leaf config');
    return campaigns;
}
const written = (version) => !!version && (!!version.subject || !!version.preheader || version.blocks.length > 0);
/** The languages as the back-office sent them, checked. A language with nothing written is left out. */
function normalizeContent(input) {
    const { locales } = localesOf(state.config);
    if (input === undefined || input === null)
        return {};
    if (typeof input !== 'object' || Array.isArray(input))
        throw new MailError('invalid_content', 400, 'content must be one version per language');
    const content = {};
    for (const locale of locales) {
        const raw = input[locale];
        if (!raw)
            continue;
        const version = {
            subject: normalizeLine(raw.subject, 'subject', false),
            preheader: normalizeLine(raw.preheader, 'preheader', false),
            blocks: raw.blocks === undefined || raw.blocks === null ? [] : normalizeBlocks(raw.blocks),
        };
        if (written(version))
            content[locale] = version;
    }
    return content;
}
/** Stored content is checked again on the way out; what fails is dropped (the default language then stands in). */
function storedContent(campaign) {
    try {
        return normalizeContent(campaign.content);
    }
    catch (err) {
        console.error(`[ETHMailLeaf] Campaign #${campaign.id}'s content is invalid:`, (err === null || err === void 0 ? void 0 : err.message) || err);
        return {};
    }
}
/** The version for a language, else the default language's. */
function versionFor(content, locale) {
    const { defaultLocale } = localesOf(state.config);
    if (written(content[locale]))
        return { version: content[locale], locale };
    if (written(content[defaultLocale]))
        return { version: content[defaultLocale], locale: defaultLocale };
    return null;
}
/** What a campaign needs before it can leave. */
function checkSendable(campaign, content) {
    const { locales, defaultLocale } = localesOf(state.config);
    if (!campaign.audience)
        throw new MailError('audience_required', 400, 'Choose who the campaign goes to');
    const main = content[defaultLocale];
    if (!(main === null || main === void 0 ? void 0 : main.subject) || !main.blocks.length) {
        throw new MailError('content_required', 400, `Write the ${defaultLocale.toUpperCase()} version, with a subject and a block: it goes to everyone whose language has none`);
    }
    for (const locale of locales) {
        const version = content[locale];
        if (version && (!version.subject || !version.blocks.length)) {
            throw new MailError('content_incomplete', 400, `The ${locale.toUpperCase()} version needs a subject and at least one block, or nothing at all`);
        }
    }
}
// ── Variables and recipients
export function campaignVariables() {
    var _a, _b;
    return variablesOf({ variables: (_b = (_a = state.config.campaigns) === null || _a === void 0 ? void 0 : _a.variables) !== null && _b !== void 0 ? _b : {} });
}
function examples() {
    return Object.fromEntries(campaignVariables().map((v) => [v.name, v.example]));
}
/** Only plain values reach a recipient's row: their name, their unit. */
function cleanData(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
        return {};
    const out = {};
    for (const [key, value] of Object.entries(input).slice(0, 50)) {
        if (typeof value === 'string')
            out[key] = value.slice(0, 500);
        else if (typeof value === 'number' || typeof value === 'boolean')
            out[key] = value;
    }
    return out;
}
/** Valid addresses, once each, lower case, with their language. */
function normalizeRecipients(people) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const seen = new Set();
        const out = [];
        for (const p of people !== null && people !== void 0 ? people : []) {
            const email = typeof (p === null || p === void 0 ? void 0 : p.email) === 'string' ? p.email.trim().toLowerCase() : '';
            if (email.length > 320 || !EMAIL.test(email) || seen.has(email))
                continue;
            seen.add(email);
            const userId = Number.isInteger(p.userId) ? p.userId : Number.isInteger((_a = p.user) === null || _a === void 0 ? void 0 : _a.id) ? p.user.id : null;
            out.push({ email, user_id: userId, locale: yield resolveLocale({ locale: p.locale, user: p.user }), data: cleanData(p.data) });
        }
        return out;
    });
}
export function listAudiences() {
    return __awaiter(this, void 0, void 0, function* () {
        const list = yield config().audiences();
        return (list !== null && list !== void 0 ? list : []).filter((a) => a && typeof a.key === 'string' && a.key).map((a) => ({ key: a.key, label: a.label || a.key, description: a.description, group: a.group }));
    });
}
function findAudience(key) {
    return __awaiter(this, void 0, void 0, function* () {
        const found = (yield listAudiences()).find((a) => a.key === key);
        if (!found)
            throw new MailError('audience_not_found', 400, 'This audience no longer exists: choose another one');
        return found;
    });
}
/** How many people an audience reaches today, by language. */
export function countAudience(key) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const audience = yield findAudience(key);
        const people = yield config().recipients(audience.key);
        const list = yield normalizeRecipients(people !== null && people !== void 0 ? people : []);
        const unsubscribed = yield unsubscribedAmong(list.map((p) => p.email));
        const byLocale = {};
        for (const p of list)
            if (!unsubscribed.has(p.email))
                byLocale[p.locale] = ((_a = byLocale[p.locale]) !== null && _a !== void 0 ? _a : 0) + 1;
        return {
            audience: audience.key,
            reachable: list.length - unsubscribed.size,
            unsubscribed: unsubscribed.size,
            /** No address, an invalid one, or one already listed. */
            invalid: ((_b = people === null || people === void 0 ? void 0 : people.length) !== null && _b !== void 0 ? _b : 0) - list.length,
            byLocale,
        };
    });
}
// ── What the back-office reads
function find(idInput) {
    return __awaiter(this, void 0, void 0, function* () {
        const id = Number(idInput);
        const campaign = Number.isInteger(id) && id > 0 ? yield MailCampaign.findByPk(id) : null;
        if (!campaign)
            throw new MailError('campaign_not_found', 404);
        return campaign;
    });
}
function stats(c) {
    return {
        recipients: c.recipients_count,
        sent: c.sent_count,
        failed: c.failed_count,
        skipped: c.skipped_count,
        unsubscribed: c.unsubscribed_count,
        pending: Math.max(0, c.recipients_count - c.sent_count - c.failed_count - c.skipped_count),
    };
}
function summary(c, names) {
    var _a, _b, _c, _d, _e;
    const { defaultLocale } = localesOf(state.config);
    const content = ((_a = c.content) !== null && _a !== void 0 ? _a : {});
    return {
        id: c.id,
        name: c.name,
        status: c.status,
        audience: c.audience,
        audienceLabel: c.audience_label,
        subject: (_e = (_c = (_b = content[defaultLocale]) === null || _b === void 0 ? void 0 : _b.subject) !== null && _c !== void 0 ? _c : (_d = Object.values(content)[0]) === null || _d === void 0 ? void 0 : _d.subject) !== null && _e !== void 0 ? _e : '',
        locales: Object.keys(content),
        scheduledAt: c.scheduled_at,
        startedAt: c.started_at,
        finishedAt: c.finished_at,
        stats: stats(c),
        error: c.error,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        createdBy: person(c.created_by, names),
        updatedBy: person(c.updated_by, names),
        scheduledBy: person(c.scheduled_by, names),
    };
}
export function listCampaigns(query) {
    return __awaiter(this, void 0, void 0, function* () {
        const statuses = typeof (query === null || query === void 0 ? void 0 : query.status) === 'string' && query.status ? query.status.split(',') : null;
        const page = Math.max(1, Number(query === null || query === void 0 ? void 0 : query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(query === null || query === void 0 ? void 0 : query.limit) || 50));
        const { rows, count } = yield MailCampaign.findAndCountAll({
            where: statuses ? { status: { [Op.in]: statuses } } : {},
            order: [['created_at', 'DESC']],
            offset: (page - 1) * limit,
            limit,
        });
        const names = yield peopleNames(rows.flatMap((c) => [c.created_by, c.updated_by, c.scheduled_by]));
        return { items: rows.map((c) => summary(c, names)), total: count, page, limit };
    });
}
export function readCampaign(idInput) {
    return __awaiter(this, void 0, void 0, function* () {
        const campaign = yield find(idInput);
        const names = yield peopleNames([campaign.created_by, campaign.updated_by, campaign.scheduled_by]);
        const content = storedContent(campaign);
        const declared = new Set(campaignVariables().map((v) => v.name));
        const used = new Set(Object.values(content).flatMap((v) => placeholdersOf(v)));
        return Object.assign(Object.assign({}, summary(campaign, names)), { content, editable: EDITABLE.includes(campaign.status), 
            /** Written in the content, but no recipient has it: it will come out blank. */
            unknown: [...used].filter((name) => !declared.has(name) && name !== 'unsubscribe_url') });
    });
}
// ── What the back-office changes
export function createCampaign(body, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const name = normalizeName(body === null || body === void 0 ? void 0 : body.name) || 'Untitled campaign';
        const campaign = yield MailCampaign.create({
            name,
            status: 'draft',
            audience: typeof (body === null || body === void 0 ? void 0 : body.audience) === 'string' && body.audience ? body.audience.slice(0, 200) : null,
            content: normalizeContent(body === null || body === void 0 ? void 0 : body.content),
            created_by: userId,
            updated_by: userId,
        });
        return readCampaign(campaign.id);
    });
}
function normalizeName(value) {
    if (value === undefined || value === null)
        return '';
    if (typeof value !== 'string')
        throw new MailError('invalid_name', 400, 'The name must be text');
    const name = value.replace(/\s+/g, ' ').trim();
    if (name.length > 200)
        throw new MailError('invalid_name', 400, 'The name is longer than 200 characters');
    return name;
}
function lockedMessage(status) {
    return status === 'scheduled' ? 'Only a draft can be changed: unschedule it first' : 'This campaign has left: duplicate it to send it again';
}
export function updateCampaign(idInput, body, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const campaign = yield find(idInput);
        if (!EDITABLE.includes(campaign.status))
            throw new MailError('campaign_locked', 409, lockedMessage(campaign.status));
        const values = { updated_by: userId };
        if ((body === null || body === void 0 ? void 0 : body.name) !== undefined)
            values.name = normalizeName(body.name) || campaign.name;
        if ((body === null || body === void 0 ? void 0 : body.audience) !== undefined)
            values.audience = typeof body.audience === 'string' && body.audience ? body.audience.slice(0, 200) : null;
        if ((body === null || body === void 0 ? void 0 : body.content) !== undefined)
            values.content = normalizeContent(body.content);
        // Only while it is still a draft: a schedule that landed meanwhile wins.
        const [changed] = yield MailCampaign.update(values, { where: { id: campaign.id, status: 'draft' } });
        if (!changed)
            throw new MailError('campaign_locked', 409, lockedMessage((yield find(campaign.id)).status));
        return readCampaign(campaign.id);
    });
}
export function deleteCampaign(idInput) {
    return __awaiter(this, void 0, void 0, function* () {
        const campaign = yield find(idInput);
        if (!DELETABLE.includes(campaign.status))
            throw new MailError('campaign_busy', 409, 'Unschedule or stop the campaign before deleting it');
        yield MailCampaign.sequelize.transaction((transaction) => __awaiter(this, void 0, void 0, function* () {
            yield MailCampaignRecipient.destroy({ where: { campaign_id: campaign.id }, transaction });
            yield campaign.destroy({ transaction });
        }));
        return { deleted: true, id: campaign.id };
    });
}
export function duplicateCampaign(idInput, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const source = yield find(idInput);
        const copy = yield MailCampaign.create({
            name: `${source.name} (copy)`.slice(0, 200),
            status: 'draft',
            audience: source.audience,
            content: storedContent(source),
            created_by: userId,
            updated_by: userId,
        });
        return readCampaign(copy.id);
    });
}
/** The API's address for unsubscribe links: the config's, else the one the back-office reached. */
function publicUrl(origin) {
    var _a;
    const configured = (_a = state.config.campaigns) === null || _a === void 0 ? void 0 : _a.publicUrl;
    if (configured && /^https?:\/\//i.test(configured))
        return configured.replace(/\/+$/, '');
    return origin ? origin.replace(/\/+$/, '') : null;
}
export function scheduleCampaign(idInput, body, userId, origin) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const campaign = yield find(idInput);
        if (campaign.status !== 'draft')
            throw new MailError('campaign_locked', 409, 'This campaign is not a draft anymore');
        checkSendable(campaign, storedContent(campaign));
        const audience = yield findAudience(campaign.audience);
        const base = publicUrl(origin);
        if (!base)
            throw new MailError('public_url_missing', 500, "Set the mail leaf's campaigns.publicUrl: the unsubscribe links need the API's address");
        let at = new Date();
        if (body === null || body === void 0 ? void 0 : body.scheduledAt) {
            at = new Date(body.scheduledAt);
            if (Number.isNaN(at.getTime()))
                throw new MailError('invalid_date', 400, 'The date is not valid');
            if (at.getTime() < Date.now() - 5 * 60000)
                throw new MailError('invalid_date', 400, 'Pick a time in the future');
            if (at.getTime() > Date.now() + 366 * 24 * 3600000)
                throw new MailError('invalid_date', 400, 'Pick a time within a year');
        }
        const [scheduled] = yield MailCampaign.update({ status: 'scheduled', scheduled_at: at, audience_label: audience.label.slice(0, 300), public_url: base, scheduled_by: userId, error: null }, { where: { id: campaign.id, status: 'draft' } });
        if (!scheduled)
            throw new MailError('campaign_locked', 409, 'This campaign is not a draft anymore');
        // Due now: no need to wait for the next sweep.
        if (at.getTime() <= Date.now())
            (_b = (_a = setTimeout(() => sweepOnce(), 500)).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
        return readCampaign(campaign.id);
    });
}
export function unscheduleCampaign(idInput, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const campaign = yield find(idInput);
        const [done] = yield MailCampaign.update({ status: 'draft', scheduled_by: null, updated_by: userId }, { where: { id: campaign.id, status: 'scheduled' } });
        if (!done)
            throw new MailError('campaign_started', 409, 'The campaign has already started: stop it instead');
        return readCampaign(campaign.id);
    });
}
/** Stops it: what has left has left, the rest stays home. */
export function cancelCampaign(idInput, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const campaign = yield find(idInput);
        const [done] = yield MailCampaign.update({ status: 'cancelled', finished_at: new Date(), updated_by: userId }, { where: { id: campaign.id, status: { [Op.in]: ['scheduled', 'preparing', 'sending'] } } });
        if (!done)
            throw new MailError('campaign_not_running', 409, 'This campaign is not sending');
        yield MailCampaignRecipient.update({ status: 'cancelled' }, { where: { campaign_id: campaign.id, status: 'pending' } });
        yield refreshStats(campaign.id);
        return readCampaign(campaign.id);
    });
}
// ── Preview and test
function previewVersion(body) {
    var _a;
    const locale = checkLocale(body === null || body === void 0 ? void 0 : body.locale);
    const content = normalizeContent({ [locale]: body !== null && body !== void 0 ? body : {} });
    return { version: (_a = content[locale]) !== null && _a !== void 0 ? _a : { subject: '', preheader: '', blocks: [] }, locale };
}
/** A draft as a recipient sees it, with the example variables and the unsubscribe line. */
export function previewCampaign(body, origin) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { version, locale } = previewVersion(body);
        const data = Object.assign(Object.assign(Object.assign({}, examples()), cleanData(body === null || body === void 0 ? void 0 : body.data)), { unsubscribe_url: `${(_a = publicUrl(origin)) !== null && _a !== void 0 ? _a : 'https://example.com'}/mail/unsubscribe` });
        const rendered = renderVersion(version, locale, data, yield activeTheme(), unsubscribeNotice(locale));
        const declared = new Set(campaignVariables().map((v) => v.name));
        return Object.assign(Object.assign({}, rendered), { unknown: placeholdersOf(version).filter((name) => !declared.has(name) && name !== 'unsubscribe_url') });
    });
}
/** The draft in one language to one address, `[Test]` in front of the subject. Its unsubscribe link works. */
export function testCampaign(body, fallbackTo, origin) {
    return __awaiter(this, void 0, void 0, function* () {
        const to = typeof (body === null || body === void 0 ? void 0 : body.to) === 'string' && body.to.trim() ? body.to.trim().toLowerCase() : fallbackTo === null || fallbackTo === void 0 ? void 0 : fallbackTo.toLowerCase();
        if (!to || !EMAIL.test(to))
            throw new MailError('invalid_recipient', 400);
        const { version, locale } = previewVersion(body);
        if (!version.subject || !version.blocks.length)
            throw new MailError('content_required', 400, 'Write a subject and at least one block first');
        const base = publicUrl(origin);
        const url = base ? yield unsubscribeUrl(base, to, null, locale) : '';
        const rendered = renderVersion(version, locale, Object.assign(Object.assign(Object.assign({}, examples()), cleanData(body === null || body === void 0 ? void 0 : body.data)), { unsubscribe_url: url }), yield activeTheme(), unsubscribeNotice(locale));
        const subject = '[Test] ' + rendered.subject;
        const result = yield pulse()
            .email()
            .send({ to, from: state.config.from, replyTo: state.config.replyTo, subject, html: rendered.html, text: rendered.text, headers: url ? unsubscribeHeaders(url) : undefined }, state.config.provider);
        if (!(result === null || result === void 0 ? void 0 : result.success))
            throw new MailError('send_failed', 502, (result === null || result === void 0 ? void 0 : result.error) || 'The provider refused the email');
        return { sent: true, to, subject, locale };
    });
}
function unsubscribeHeaders(url) {
    return { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
}
// ── Results
const RECIPIENT_STATUSES = ['pending', 'sending', 'sent', 'failed', 'skipped', 'cancelled'];
export function listRecipients(idInput, query) {
    return __awaiter(this, void 0, void 0, function* () {
        const campaign = yield find(idInput);
        const page = Math.max(1, Number(query === null || query === void 0 ? void 0 : query.page) || 1);
        const limit = Math.min(200, Math.max(1, Number(query === null || query === void 0 ? void 0 : query.limit) || 50));
        const where = { campaign_id: campaign.id };
        if (typeof (query === null || query === void 0 ? void 0 : query.status) === 'string' && RECIPIENT_STATUSES.includes(query.status))
            where.status = query.status;
        if (typeof (query === null || query === void 0 ? void 0 : query.search) === 'string' && query.search.trim())
            where.email = { [Op.like]: `%${query.search.trim().toLowerCase().replace(/[%_\\]/g, '\\$&')}%` };
        const { rows, count } = yield MailCampaignRecipient.findAndCountAll({
            where,
            attributes: ['id', 'email', 'user_id', 'locale', 'status', 'error', 'sent_at', 'updated_at'],
            order: [['id', 'ASC']],
            offset: (page - 1) * limit,
            limit,
        });
        const unsubscribed = yield MailUnsubscribe.findAll({ where: { campaign_id: campaign.id, email: { [Op.in]: rows.map((r) => r.email) } }, attributes: ['email'], raw: true });
        const left = new Set(unsubscribed.map((u) => u.email));
        return {
            items: rows.map((r) => ({
                id: r.id,
                email: r.email,
                userId: r.user_id,
                locale: r.locale,
                status: r.status,
                error: r.error,
                sentAt: r.sent_at,
                unsubscribed: left.has(r.email),
            })),
            total: count,
            page,
            limit,
        };
    });
}
function refreshStats(campaignId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const rows = (yield MailCampaignRecipient.findAll({
            where: { campaign_id: campaignId },
            attributes: ['status', [fn('COUNT', col('id')), 'count']],
            group: ['status'],
            raw: true,
        }));
        const by = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
        const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
        yield MailCampaign.update({
            recipients_count: total,
            sent_count: (_a = by.sent) !== null && _a !== void 0 ? _a : 0,
            failed_count: (_b = by.failed) !== null && _b !== void 0 ? _b : 0,
            skipped_count: ((_c = by.skipped) !== null && _c !== void 0 ? _c : 0) + ((_d = by.cancelled) !== null && _d !== void 0 ? _d : 0),
            unsubscribed_count: yield MailUnsubscribe.count({ where: { campaign_id: campaignId } }),
        }, { where: { id: campaignId }, silent: true });
    });
}
// ── Sending
/** Lists a due campaign's recipients, then lets the sweep send them. */
function prepare(campaignId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const campaign = yield MailCampaign.findByPk(campaignId);
        if (!campaign || campaign.status !== 'preparing')
            return;
        let people;
        try {
            people = (_a = (yield config().recipients(campaign.audience))) !== null && _a !== void 0 ? _a : [];
        }
        catch (err) {
            console.error(`[ETHMailLeaf] Campaign #${campaignId}: the audience could not be read:`, (err === null || err === void 0 ? void 0 : err.message) || err);
            yield MailCampaign.update({ status: 'failed', finished_at: new Date(), error: `The audience could not be read: ${(err === null || err === void 0 ? void 0 : err.message) || err}` }, { where: { id: campaignId, status: 'preparing' } });
            return;
        }
        const list = yield normalizeRecipients(people);
        const unsubscribed = yield unsubscribedAmong(list.map((p) => p.email));
        for (let i = 0; i < list.length; i += 500) {
            yield MailCampaignRecipient.bulkCreate(list.slice(i, i + 500).map((p) => ({
                campaign_id: campaignId,
                email: p.email,
                user_id: p.user_id,
                locale: p.locale,
                data: p.data,
                status: unsubscribed.has(p.email) ? 'skipped' : 'pending',
                error: unsubscribed.has(p.email) ? 'Unsubscribed' : null,
            })), { ignoreDuplicates: true });
        }
        const [started] = yield MailCampaign.update({ status: 'sending' }, { where: { id: campaignId, status: 'preparing' } });
        // Stopped while it listed: nothing it listed leaves.
        if (!started)
            yield MailCampaignRecipient.update({ status: 'cancelled' }, { where: { campaign_id: campaignId, status: 'pending' } });
        yield refreshStats(campaignId);
        console.log(`[ETHMailLeaf] Campaign #${campaignId}: ${list.length - unsubscribed.size} recipient(s), ${unsubscribed.size} unsubscribed`);
    });
}
function deliver(campaign, content, recipient, theme) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const picked = versionFor(content, recipient.locale);
        if (!picked)
            return { sent: false, error: 'The campaign has no content' };
        const url = yield unsubscribeUrl(campaign.public_url, recipient.email, campaign.id, picked.locale);
        const rendered = renderVersion(picked.version, picked.locale, Object.assign(Object.assign({}, ((_a = recipient.data) !== null && _a !== void 0 ? _a : {})), { unsubscribe_url: url }), theme, unsubscribeNotice(picked.locale));
        try {
            const result = yield pulse()
                .email()
                .send({
                to: recipient.email,
                from: state.config.from,
                replyTo: state.config.replyTo,
                subject: rendered.subject,
                html: rendered.html,
                text: rendered.text,
                headers: unsubscribeHeaders(url),
                userId: (_b = recipient.user_id) !== null && _b !== void 0 ? _b : undefined,
            }, state.config.provider);
            return (result === null || result === void 0 ? void 0 : result.success) ? { sent: true, messageId: result.messageId } : { sent: false, error: String((result === null || result === void 0 ? void 0 : result.error) || 'Refused by the provider') };
        }
        catch (err) {
            return { sent: false, error: String((err === null || err === void 0 ? void 0 : err.message) || err) };
        }
    });
}
/** Takes up to `limit` addresses of a campaign and sends them. Returns how many it took. */
function sendBatch(campaign, limit) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const ids = (yield MailCampaignRecipient.findAll({ where: { campaign_id: campaign.id, status: 'pending' }, attributes: ['id'], order: [['id', 'ASC']], limit, raw: true })).map((r) => r.id);
        if (!ids.length)
            return 0;
        // Only the rows still pending are taken; another server's are left to it.
        const claim = randomUUID();
        yield MailCampaignRecipient.update({ status: 'sending', claim }, { where: { id: { [Op.in]: ids }, status: 'pending' } });
        const batch = yield MailCampaignRecipient.findAll({ where: { claim, status: 'sending' }, order: [['id', 'ASC']] });
        const content = storedContent(campaign);
        const theme = yield activeTheme();
        for (const recipient of batch) {
            const current = yield MailCampaign.findByPk(campaign.id, { attributes: ['status'] });
            if ((current === null || current === void 0 ? void 0 : current.status) !== 'sending') {
                yield MailCampaignRecipient.update({ status: 'cancelled' }, { where: { claim, status: 'sending' } });
                break;
            }
            if (yield isUnsubscribed(recipient.email)) {
                yield recipient.update({ status: 'skipped', error: 'Unsubscribed' });
                continue;
            }
            const result = yield deliver(campaign, content, recipient, theme);
            yield recipient.update(result.sent
                ? { status: 'sent', sent_at: new Date(), message_id: (_b = (_a = result.messageId) === null || _a === void 0 ? void 0 : _a.slice(0, 300)) !== null && _b !== void 0 ? _b : null, error: null }
                : { status: 'failed', error: (_d = (_c = result.error) === null || _c === void 0 ? void 0 : _c.slice(0, 2000)) !== null && _d !== void 0 ? _d : 'Not sent' });
        }
        yield refreshStats(campaign.id);
        return batch.length;
    });
}
function finishIfDone(campaignId) {
    return __awaiter(this, void 0, void 0, function* () {
        const open = yield MailCampaignRecipient.count({ where: { campaign_id: campaignId, status: { [Op.in]: ['pending', 'sending'] } } });
        if (open)
            return;
        const [done] = yield MailCampaign.update({ status: 'sent', finished_at: new Date() }, { where: { id: campaignId, status: 'sending' } });
        if (done) {
            yield refreshStats(campaignId);
            console.log(`[ETHMailLeaf] Campaign #${campaignId} sent`);
        }
    });
}
function batchSize() {
    var _a;
    const perMinute = Number((_a = state.config.campaigns) === null || _a === void 0 ? void 0 : _a.perMinute) || 60;
    return Math.max(1, Math.floor((perMinute * SWEEP_MS) / 60000));
}
function sweep() {
    return __awaiter(this, void 0, void 0, function* () {
        // 1. Due campaigns: list their recipients.
        const due = yield MailCampaign.findAll({ where: { status: 'scheduled', scheduled_at: { [Op.lte]: new Date() } }, order: [['scheduled_at', 'ASC']], limit: 5 });
        for (const campaign of due) {
            const [taken] = yield MailCampaign.update({ status: 'preparing', started_at: new Date() }, { where: { id: campaign.id, status: 'scheduled' } });
            if (taken)
                yield prepare(campaign.id);
        }
        // 2. Listing for too long: its server stopped. Listing again is safe, one row per address.
        const stale = yield MailCampaign.findAll({ where: { status: 'preparing', updated_at: { [Op.lt]: new Date(Date.now() - PREPARE_STALE_MS) } }, limit: 5 });
        for (const campaign of stale) {
            const [taken] = yield MailCampaign.update({ status: 'preparing' }, { where: { id: campaign.id, status: 'preparing', updated_at: campaign.updated_at } });
            if (taken)
                yield prepare(campaign.id);
        }
        // 3. Rows a stopped server took and never finished: failed, not sent again (they may have left).
        const interrupted = yield MailCampaignRecipient.findAll({
            where: { status: 'sending', updated_at: { [Op.lt]: new Date(Date.now() - SENDING_STALE_MS) } },
            attributes: ['id', 'campaign_id'],
            raw: true,
        });
        if (interrupted.length) {
            yield MailCampaignRecipient.update({ status: 'failed', error: 'Interrupted: the server stopped while sending it. Not sent again, in case it left.' }, { where: { id: { [Op.in]: interrupted.map((r) => r.id) }, status: 'sending' } });
            for (const id of new Set(interrupted.map((r) => r.campaign_id)))
                yield refreshStats(id);
        }
        // 4. Sending: the next batch, oldest campaign first, within the rate.
        let budget = batchSize();
        const sending = yield MailCampaign.findAll({ where: { status: 'sending' }, order: [['started_at', 'ASC']] });
        for (const campaign of sending) {
            if (budget > 0)
                budget -= yield sendBatch(campaign, budget);
            yield finishIfDone(campaign.id);
        }
    });
}
let timer = null;
let running = false;
function sweepOnce() {
    return __awaiter(this, void 0, void 0, function* () {
        if (running)
            return;
        running = true;
        try {
            yield sweep();
        }
        catch (err) {
            console.error('[ETHMailLeaf] Campaign sweep failed:', (err === null || err === void 0 ? void 0 : err.message) || err);
        }
        finally {
            running = false;
        }
    });
}
/**
 * Sends the due campaigns every 20 seconds. The first sweep waits: a CLI
 * command boots the app too, and is usually done before it.
 */
export function startCampaignSweep() {
    if (!state.config.campaigns || timer)
        return;
    setTimeout(sweepOnce, 15000).unref();
    timer = setInterval(sweepOnce, SWEEP_MS);
    timer.unref();
}
/** What the back-office needs to open the Campaigns page. */
export function campaignsFeature() {
    var _a;
    const { locales, defaultLocale, rtlLocales } = localesOf(state.config);
    return {
        locales,
        defaultLocale,
        rtlLocales: rtlLocales.filter((l) => locales.includes(l)),
        variables: campaignVariables(),
        perMinute: Number((_a = state.config.campaigns) === null || _a === void 0 ? void 0 : _a.perMinute) || 60,
        dir: Object.fromEntries(locales.map((l) => [l, isRtl(state.config, l) ? 'rtl' : 'ltr'])),
    };
}
