import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { Op } from 'sequelize'

import { MailCampaign } from '../models/MailCampaign.js'
import { MailCampaignRecipient } from '../models/MailCampaignRecipient.js'
import { MailSetting } from '../models/MailSetting.js'
import { MailUnsubscribe } from '../models/MailUnsubscribe.js'
import { state } from './state.js'
import { activeTheme } from './theme.js'
import { isRtl, languageOf, localesOf, localize } from './options.js'

// ──────────────────────────────────────────────────────────────────────────
// Unsubscribing from campaigns. Every campaign email carries a link signed for
// its address; it opens a page that asks before unsubscribing (mail scanners
// open links on their own), and inboxes' own button posts to it at once
// (RFC 8058). Emails a person needs, like a sign-in code, never check this.
// ──────────────────────────────────────────────────────────────────────────

const SECRET_KEY = 'unsubscribe_secret'
let secret: string | null = null

/** Made once and kept in `mail_settings`: links stay valid across restarts and servers. */
async function signingSecret(): Promise<string> {
    if (secret) return secret
    let row = await MailSetting.findOne({ where: { key: SECRET_KEY } })
    if (!row) {
        try {
            row = await MailSetting.create({ key: SECRET_KEY, value: randomBytes(32).toString('hex') } as any)
        } catch {
            // Another server made it first.
            row = await MailSetting.findOne({ where: { key: SECRET_KEY } })
        }
    }
    if (!row?.value) throw new Error('[ETHMailLeaf] No unsubscribe secret')
    secret = String(row.value)
    return secret
}

const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64url')
const decode = (value: string) => Buffer.from(value, 'base64url').toString('utf8')

async function tokenFor(email: string): Promise<string> {
    return createHmac('sha256', await signingSecret())
        .update(email.toLowerCase())
        .digest('base64url')
        .slice(0, 32)
}

/** `https://api…/mail/unsubscribe?e=…&t=…`: the link at the bottom of a campaign email. */
export async function unsubscribeUrl(base: string, email: string, campaignId: number | null, locale: string): Promise<string> {
    const params = new URLSearchParams({ e: encode(email.toLowerCase()), t: await tokenFor(email) })
    if (campaignId) params.set('c', String(campaignId))
    params.set('l', locale)
    return `${base.replace(/\/+$/, '')}/mail/unsubscribe?${params}`
}

/** The address a link was signed for, or null. */
export async function emailFromLink(query: any): Promise<string | null> {
    if (typeof query?.e !== 'string' || typeof query?.t !== 'string') return null
    let email: string
    try {
        email = decode(query.e).trim().toLowerCase()
    } catch {
        return null
    }
    if (!email.includes('@') || email.length > 320) return null
    const expected = Buffer.from(await tokenFor(email))
    const given = Buffer.from(query.t)
    return expected.length === given.length && timingSafeEqual(expected, given) ? email : null
}

export async function isUnsubscribed(email: string): Promise<boolean> {
    return !!(await MailUnsubscribe.findOne({ where: { email: email.toLowerCase() }, attributes: ['id'] }))
}

/** Which of these addresses unsubscribed. */
export async function unsubscribedAmong(emails: string[]): Promise<Set<string>> {
    const found = new Set<string>()
    for (let i = 0; i < emails.length; i += 1000) {
        const rows = await MailUnsubscribe.findAll({ where: { email: { [Op.in]: emails.slice(i, i + 1000) } }, attributes: ['email'], raw: true })
        rows.forEach((row: any) => found.add(row.email))
    }
    return found
}

/** Records it once; the campaign whose link was used counts it. */
export async function unsubscribe(email: string, campaignInput: unknown): Promise<void> {
    if (await isUnsubscribed(email)) return
    const campaignId = Number(campaignInput)
    const campaign = Number.isInteger(campaignId) && campaignId > 0 ? await MailCampaign.findByPk(campaignId, { attributes: ['id'] }) : null
    const recipient = campaign ? await MailCampaignRecipient.findOne({ where: { campaign_id: campaign.id, email }, attributes: ['user_id'] }) : null
    try {
        await MailUnsubscribe.create({ email, campaign_id: campaign?.id ?? null, user_id: recipient?.user_id ?? null } as any)
    } catch {
        return // Twice at once: the first one counts.
    }
    if (campaign) await MailCampaign.increment('unsubscribed_count', { where: { id: campaign.id } })
}

// ── The page

type PageState = 'confirm' | 'done' | 'invalid'

const COPY: Record<string, Record<PageState, { title: string; body: string; button?: string }>> = {
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
}

/** The footer line of a campaign email, when the config doesn't write one. */
export const DEFAULT_UNSUBSCRIBE_TEXT: Record<string, string> = {
    en: 'You receive this email because you have an account with us. [Unsubscribe]({{unsubscribe_url}})',
    ar: 'تصلك هذه الرسالة لأن لديك حساباً لدينا. [إلغاء الاشتراك]({{unsubscribe_url}})',
    fr: 'Vous recevez cet email car vous avez un compte chez nous. [Se désabonner]({{unsubscribe_url}})',
}

export function unsubscribeNotice(locale: string): string {
    const { defaultLocale } = localesOf(state.config)
    const custom = state.config.campaigns?.unsubscribeText
    return custom ? localize(custom, locale, defaultLocale) : DEFAULT_UNSUBSCRIBE_TEXT[locale] ?? DEFAULT_UNSUBSCRIBE_TEXT.en
}

const esc = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const safeColor = (value: unknown, fallback: string) => (typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback)

/** A small page in the brand's colors, in the person's language. */
export async function unsubscribePage(pageState: PageState, query: any, email: string | null): Promise<string> {
    const lang = languageOf(query?.l) ?? localesOf(state.config).defaultLocale
    const copy = (COPY[lang] ?? COPY.en)[pageState]
    const rtl = isRtl(state.config, lang)
    const theme = await activeTheme()
    const primary = safeColor(theme.colors?.primary, '#111827')
    const onPrimary = safeColor(theme.colors?.onPrimary, '#FFFFFF')
    const background = safeColor(theme.colors?.background, '#F3F4F6')
    const brand = localize(theme.brandName, lang, localesOf(state.config).defaultLocale)
    const logo = typeof theme.logoUrl === 'string' && /^https?:\/\//i.test(theme.logoUrl) ? theme.logoUrl : ''
    const fill = (value: string) => esc(value).replace('{email}', `<strong dir="ltr">${esc(email ?? '')}</strong>`)

    // The form posts back to this same address, with its signed parameters.
    const action = `?${new URLSearchParams(Object.entries(query ?? {}).filter(([k, v]) => ['e', 't', 'c', 'l'].includes(k) && typeof v === 'string') as [string, string][])}`
    const form =
        pageState === 'confirm'
            ? `<form method="post" action="${esc(action)}"><button type="submit">${esc(copy.button ?? '')}</button></form>`
            : ''

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
</html>`
}
