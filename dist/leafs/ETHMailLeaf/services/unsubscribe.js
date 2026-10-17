var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Op } from 'sequelize';
import { MailCampaign } from '../models/MailCampaign.js';
import { MailCampaignRecipient } from '../models/MailCampaignRecipient.js';
import { MailSetting } from '../models/MailSetting.js';
import { MailUnsubscribe } from '../models/MailUnsubscribe.js';
import { state } from './state.js';
import { activeTheme } from './theme.js';
import { isRtl, languageOf, localesOf, localize } from './options.js';
// ──────────────────────────────────────────────────────────────────────────
// Unsubscribing from campaigns. Every campaign email carries a link signed for
// its address; it opens a page that asks before unsubscribing (mail scanners
// open links on their own), and inboxes' own button posts to it at once
// (RFC 8058). Emails a person needs, like a sign-in code, never check this.
// ──────────────────────────────────────────────────────────────────────────
const SECRET_KEY = 'unsubscribe_secret';
let secret = null;
/** Made once and kept in `mail_settings`: links stay valid across restarts and servers. */
function signingSecret() {
    return __awaiter(this, void 0, void 0, function* () {
        if (secret)
            return secret;
        let row = yield MailSetting.findOne({ where: { key: SECRET_KEY } });
        if (!row) {
            try {
                row = yield MailSetting.create({ key: SECRET_KEY, value: randomBytes(32).toString('hex') });
            }
            catch (_a) {
                // Another server made it first.
                row = yield MailSetting.findOne({ where: { key: SECRET_KEY } });
            }
        }
        if (!(row === null || row === void 0 ? void 0 : row.value))
            throw new Error('[ETHMailLeaf] No unsubscribe secret');
        secret = String(row.value);
        return secret;
    });
}
const encode = (value) => Buffer.from(value, 'utf8').toString('base64url');
const decode = (value) => Buffer.from(value, 'base64url').toString('utf8');
function tokenFor(email) {
    return __awaiter(this, void 0, void 0, function* () {
        return createHmac('sha256', yield signingSecret())
            .update(email.toLowerCase())
            .digest('base64url')
            .slice(0, 32);
    });
}
/** `https://api…/mail/unsubscribe?e=…&t=…`: the link at the bottom of a campaign email. */
export function unsubscribeUrl(base, email, campaignId, locale) {
    return __awaiter(this, void 0, void 0, function* () {
        const params = new URLSearchParams({ e: encode(email.toLowerCase()), t: yield tokenFor(email) });
        if (campaignId)
            params.set('c', String(campaignId));
        params.set('l', locale);
        return `${base.replace(/\/+$/, '')}/mail/unsubscribe?${params}`;
    });
}
/** The address a link was signed for, or null. */
export function emailFromLink(query) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof (query === null || query === void 0 ? void 0 : query.e) !== 'string' || typeof (query === null || query === void 0 ? void 0 : query.t) !== 'string')
            return null;
        let email;
        try {
            email = decode(query.e).trim().toLowerCase();
        }
        catch (_a) {
            return null;
        }
        if (!email.includes('@') || email.length > 320)
            return null;
        const expected = Buffer.from(yield tokenFor(email));
        const given = Buffer.from(query.t);
        return expected.length === given.length && timingSafeEqual(expected, given) ? email : null;
    });
}
export function isUnsubscribed(email) {
    return __awaiter(this, void 0, void 0, function* () {
        return !!(yield MailUnsubscribe.findOne({ where: { email: email.toLowerCase() }, attributes: ['id'] }));
    });
}
/** Which of these addresses unsubscribed. */
export function unsubscribedAmong(emails) {
    return __awaiter(this, void 0, void 0, function* () {
        const found = new Set();
        for (let i = 0; i < emails.length; i += 1000) {
            const rows = yield MailUnsubscribe.findAll({ where: { email: { [Op.in]: emails.slice(i, i + 1000) } }, attributes: ['email'], raw: true });
            rows.forEach((row) => found.add(row.email));
        }
        return found;
    });
}
/** Records it once; the campaign whose link was used counts it. */
export function unsubscribe(email, campaignInput) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (yield isUnsubscribed(email))
            return;
        const campaignId = Number(campaignInput);
        const campaign = Number.isInteger(campaignId) && campaignId > 0 ? yield MailCampaign.findByPk(campaignId, { attributes: ['id'] }) : null;
        const recipient = campaign ? yield MailCampaignRecipient.findOne({ where: { campaign_id: campaign.id, email }, attributes: ['user_id'] }) : null;
        try {
            yield MailUnsubscribe.create({ email, campaign_id: (_a = campaign === null || campaign === void 0 ? void 0 : campaign.id) !== null && _a !== void 0 ? _a : null, user_id: (_b = recipient === null || recipient === void 0 ? void 0 : recipient.user_id) !== null && _b !== void 0 ? _b : null });
        }
        catch (_c) {
            return; // Twice at once: the first one counts.
        }
        if (campaign)
            yield MailCampaign.increment('unsubscribed_count', { where: { id: campaign.id } });
    });
}
const COPY = {
    en: {
        confirm: {
            title: 'Unsubscribe',
            body: 'Stop receiving our newsletters at {email}? You will still get the emails about your account, like sign-in codes.',
            button: 'Unsubscribe',
        },
        done: { title: 'You are unsubscribed', body: '{email} will not receive our newsletters anymore.' },
        invalid: { title: 'This link does not work', body: 'Use the link at the bottom of the most recent email you received from us.' },
    },
    ar: {
        confirm: {
            title: 'إلغاء الاشتراك',
            body: 'هل تريد التوقف عن تلقي رسائلنا الإخبارية على {email}؟ ستستمر في تلقي الرسائل المتعلقة بحسابك، مثل رموز الدخول.',
            button: 'إلغاء الاشتراك',
        },
        done: { title: 'تم إلغاء اشتراكك', body: 'لن يتلقى {email} رسائلنا الإخبارية بعد الآن.' },
        invalid: { title: 'هذا الرابط لا يعمل', body: 'استخدم الرابط الموجود في أسفل آخر رسالة وصلتك منا.' },
    },
    fr: {
        confirm: {
            title: 'Se désabonner',
            body: 'Ne plus recevoir nos newsletters à {email} ? Vous recevrez toujours les emails liés à votre compte, comme les codes de connexion.',
            button: 'Me désabonner',
        },
        done: { title: 'Vous êtes désabonné', body: '{email} ne recevra plus nos newsletters.' },
        invalid: { title: 'Ce lien ne fonctionne pas', body: 'Utilisez le lien en bas du dernier email que nous vous avons envoyé.' },
    },
};
/** The footer line of a campaign email, when the config doesn't write one. */
export const DEFAULT_UNSUBSCRIBE_TEXT = {
    en: 'You receive this email because you have an account with us. [Unsubscribe]({{unsubscribe_url}})',
    ar: 'تصلك هذه الرسالة لأن لديك حساباً لدينا. [إلغاء الاشتراك]({{unsubscribe_url}})',
    fr: 'Vous recevez cet email car vous avez un compte chez nous. [Se désabonner]({{unsubscribe_url}})',
};
export function unsubscribeNotice(locale) {
    var _a, _b;
    const { defaultLocale } = localesOf(state.config);
    const custom = (_a = state.config.campaigns) === null || _a === void 0 ? void 0 : _a.unsubscribeText;
    return custom ? localize(custom, locale, defaultLocale) : (_b = DEFAULT_UNSUBSCRIBE_TEXT[locale]) !== null && _b !== void 0 ? _b : DEFAULT_UNSUBSCRIBE_TEXT.en;
}
const esc = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeColor = (value, fallback) => (typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback);
/** A small page in the brand's colors, in the person's language. */
export function unsubscribePage(pageState, query, email) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const lang = (_a = languageOf(query === null || query === void 0 ? void 0 : query.l)) !== null && _a !== void 0 ? _a : localesOf(state.config).defaultLocale;
        const copy = ((_b = COPY[lang]) !== null && _b !== void 0 ? _b : COPY.en)[pageState];
        const rtl = isRtl(state.config, lang);
        const theme = yield activeTheme();
        const primary = safeColor((_c = theme.colors) === null || _c === void 0 ? void 0 : _c.primary, '#111827');
        const onPrimary = safeColor((_d = theme.colors) === null || _d === void 0 ? void 0 : _d.onPrimary, '#FFFFFF');
        const background = safeColor((_e = theme.colors) === null || _e === void 0 ? void 0 : _e.background, '#F3F4F6');
        const brand = localize(theme.brandName, lang, localesOf(state.config).defaultLocale);
        const logo = typeof theme.logoUrl === 'string' && /^https?:\/\//i.test(theme.logoUrl) ? theme.logoUrl : '';
        const fill = (value) => esc(value).replace('{email}', `<strong dir="ltr">${esc(email !== null && email !== void 0 ? email : '')}</strong>`);
        // The form posts back to this same address, with its signed parameters.
        const action = `?${new URLSearchParams(Object.entries(query !== null && query !== void 0 ? query : {}).filter(([k, v]) => ['e', 't', 'c', 'l'].includes(k) && typeof v === 'string'))}`;
        const form = pageState === 'confirm'
            ? `<form method="post" action="${esc(action)}"><button type="submit">${esc((_f = copy.button) !== null && _f !== void 0 ? _f : '')}</button></form>`
            : '';
        return `<!DOCTYPE html>
<html lang="${esc(lang)}" dir="${rtl ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(copy.title)}${brand ? ` · ${esc(brand)}` : ''}</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:${background};font-family:${rtl ? "-apple-system,'Segoe UI',Tahoma,Arial,sans-serif" : "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"};color:#111827}
main{box-sizing:border-box;width:100%;max-width:440px;margin:24px 16px;padding:36px 28px;background:#fff;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,.08);text-align:center}
img{display:block;margin:0 auto 24px;max-width:140px;height:auto}
h1{margin:0 0 12px;font-size:22px;line-height:30px}
p{margin:0;font-size:15px;line-height:24px;color:#4B5563;overflow-wrap:anywhere}
button{margin-top:24px;padding:12px 24px;border:0;border-radius:8px;background:${primary};color:${onPrimary};font:inherit;font-weight:600;font-size:15px;cursor:pointer}
</style>
</head>
<body>
<main>
${logo ? `<img src="${esc(logo)}" alt="${esc(brand)}">` : ''}
<h1>${esc(copy.title)}</h1>
<p>${fill(copy.body)}</p>
${form}
</main>
</body>
</html>`;
    });
}
