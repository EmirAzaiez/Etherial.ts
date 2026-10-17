import { Align, LocalBlock, MailTheme, localize } from './options.js'

// ──────────────────────────────────────────────────────────────────────────
// Blocks → an email inboxes show well: tables and inline styles (Outlook and
// Gmail ignore most of CSS), 600px wide and fluid below, right to left for
// Arabic, plus the plain-text version spam filters and watches read.
// ──────────────────────────────────────────────────────────────────────────

export interface RenderInput {
    subject: string
    preheader?: string
    blocks: LocalBlock[]
    data: Record<string, unknown>
    locale: string
    fallbackLocale: string
    rtl: boolean
    theme: MailTheme
    /** A line under the footer, same syntax as a text block: a campaign's unsubscribe link. */
    notice?: string
}

export interface RenderedMail {
    subject: string
    preheader: string
    html: string
    text: string
    locale: string
    dir: 'ltr' | 'rtl'
    /** `{{variables}}` the email uses that the data left empty: they came out blank. */
    missing: string[]
}

export const COLORS = {
    primary: '#111827',
    onPrimary: '#FFFFFF',
    text: '#111827',
    muted: '#6B7280',
    background: '#F3F4F6',
    card: '#FFFFFF',
    border: '#E5E7EB',
    subtle: '#F3F4F6',
}
const WARNING = { background: '#FFF8E6', bar: '#F5A524', text: '#6B4A00' }
export const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
export const FONT_RTL = "-apple-system, 'Segoe UI', Tahoma, Arial, sans-serif"
const MONO = "'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace"
/** The card's width once its padding is taken out: an image this wide fills it. */
const CONTENT_WIDTH = 504

/** `{{first_name}}`, or `{{first_name|there}}`: the text after `|` goes in when the value is empty. */
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*(?:\|([^{}|]*))?\}\}/g
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g
const BOLD = /\*\*(.+?)\*\*/g

interface Ctx {
    data: Record<string, unknown>
    missing: Set<string>
    colors: typeof COLORS
    font: string
    radius: number
    rtl: boolean
}

function esc(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Only colors and fonts reach the style attributes: a theme can't open one. */
function cssValue(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() && !/[;"<>{}]/.test(value) ? value.trim() : fallback
}

function lookup(data: Record<string, unknown>, path: string): unknown {
    let value: any = data
    for (const part of path.split('.')) {
        if (value === null || value === undefined) return undefined
        value = value[part]
    }
    return value
}

/**
 * `{{name}}` → the data, passed through `encode`. An empty value takes the
 * fallback written after `|` (already in the template's form, so not encoded
 * again), else nothing, and is noted.
 */
function fill(raw: string, ctx: Ctx, encode: (value: string) => string): string {
    return raw.replace(PLACEHOLDER, (_, name: string, fallback: string | undefined) => {
        const value = lookup(ctx.data, name)
        if (value === undefined || value === null || typeof value === 'object' || String(value).trim() === '') {
            if (fallback !== undefined) return fallback.trim()
            ctx.missing.add(name)
            return ''
        }
        return encode(String(value))
    })
}

/** Links that open something; anything else (`javascript:`, an empty variable) is dropped. */
function safeHref(raw: string, ctx: Ctx): string {
    const href = fill(raw, ctx, (v) => v).trim()
    return /^(https?:\/\/|mailto:|tel:)/i.test(href) ? href : ''
}

function side(align: Align | undefined, ctx: Ctx, fallback: Align = 'start'): 'left' | 'right' | 'center' {
    const value = align ?? fallback
    if (value === 'center') return 'center'
    return (value === 'start') !== ctx.rtl ? 'left' : 'right'
}

function inlineSegment(raw: string, ctx: Ctx): string {
    // Bold is read on the template, before the data goes in: a name with ** stays a name.
    return fill(esc(raw).replace(BOLD, '<strong>$1</strong>'), ctx, esc).replace(/\n/g, '<br>')
}

function inlineHtml(raw: string, ctx: Ctx, linkColor = ctx.colors.primary): string {
    let out = ''
    let last = 0
    for (const match of raw.matchAll(LINK)) {
        out += inlineSegment(raw.slice(last, match.index), ctx)
        const href = safeHref(match[2], ctx)
        const label = inlineSegment(match[1], ctx)
        out += href ? `<a href="${esc(href)}" target="_blank" style="color:${linkColor};text-decoration:underline">${label}</a>` : label
        last = (match.index ?? 0) + match[0].length
    }
    return out + inlineSegment(raw.slice(last), ctx)
}

function inlineText(raw: string, ctx: Ctx): string {
    return fill(raw.replace(LINK, (_, label, href) => `${label} (${href})`).replace(BOLD, '$1'), ctx, (v) => v)
}

function paragraphs(raw: string): string[] {
    return raw
        .split(/\n[ \t]*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
}

function paragraphsHtml(raw: string, ctx: Ctx, style: string, linkColor?: string): string {
    const list = paragraphs(raw)
    return list.map((p, i) => `<p style="margin:0 0 ${i === list.length - 1 ? 0 : 16}px;${style}">${inlineHtml(p, ctx, linkColor)}</p>`).join('')
}

function table(inner: string, attrs = ''): string {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"${attrs}>${inner}</table>`
}

/** One block, and the space it leaves under itself. */
function blockHtml(block: LocalBlock, ctx: Ctx): { html: string; space: number } {
    const c = ctx.colors
    const base = `font-family:${ctx.font};`
    switch (block.type) {
        case 'heading':
            return {
                html: `<h1 style="margin:0;${base}font-size:24px;line-height:32px;font-weight:700;color:${c.text};text-align:${side(block.align, ctx)}">${inlineHtml(block.text, ctx)}</h1>`,
                space: 16,
            }
        case 'text':
            return {
                html: paragraphsHtml(block.text, ctx, `${base}font-size:16px;line-height:26px;color:${block.muted ? c.muted : c.text};text-align:${side(block.align, ctx)}`),
                space: 16,
            }
        case 'button': {
            const href = safeHref(block.url, ctx) || '#'
            const outline = block.style === 'outline'
            const background = outline ? c.card : c.primary
            const color = outline ? c.primary : c.onPrimary
            const border = outline ? `border:2px solid ${c.primary};` : ''
            const button =
                `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
                `<td align="center" bgcolor="${background}" style="border-radius:${ctx.radius}px;background:${background};${border}">` +
                `<a href="${esc(href)}" target="_blank" style="display:inline-block;padding:14px 28px;${base}font-size:16px;line-height:20px;font-weight:600;color:${color};text-decoration:none;border-radius:${ctx.radius}px">${inlineSegment(block.label, ctx)}</a>` +
                `</td></tr></table>`
            return { html: table(`<tr><td align="${side(block.align, ctx)}" style="padding:8px 0 0">${button}</td></tr>`), space: 24 }
        }
        case 'code': {
            const label = block.label ? `<p style="margin:0 0 8px;${base}font-size:14px;line-height:20px;color:${c.muted};text-align:center">${inlineHtml(block.label, ctx)}</p>` : ''
            // The spacing trails after the last digit too: the extra left padding keeps the code centered.
            const code = table(
                `<tr><td align="center" dir="ltr" bgcolor="${c.subtle}" style="padding:20px 16px 20px 24px;background:${c.subtle};border-radius:${ctx.radius}px;font-family:${MONO};font-size:32px;line-height:40px;font-weight:700;letter-spacing:8px;color:${c.text}">${fill(esc(block.value), ctx, esc)}</td></tr>`
            )
            return { html: label + code, space: 24 }
        }
        case 'image': {
            const src = safeHref(block.src, ctx)
            if (!src) return { html: '', space: 0 }
            const width = block.width ?? CONTENT_WIDTH
            const alt = block.alt ? fill(esc(block.alt), ctx, esc) : ''
            const align = side(block.align, ctx, 'center')
            const margin = align === 'center' ? 'margin:0 auto;' : ''
            let img = `<img src="${esc(src)}" width="${width}" alt="${alt}" style="display:block;${margin}width:100%;max-width:${width}px;height:auto;border:0;border-radius:${ctx.radius}px">`
            const href = block.url ? safeHref(block.url, ctx) : ''
            if (href) img = `<a href="${esc(href)}" target="_blank">${img}</a>`
            return { html: table(`<tr><td align="${align}">${img}</td></tr>`), space: 24 }
        }
        case 'note': {
            const warning = block.tone === 'warning'
            const background = warning ? WARNING.background : c.subtle
            const bar = warning ? WARNING.bar : c.primary
            const color = warning ? WARNING.text : c.text
            const edge = ctx.rtl ? 'right' : 'left'
            return {
                html: table(
                    `<tr><td bgcolor="${background}" style="padding:14px 16px;background:${background};border-${edge}:3px solid ${bar};border-radius:4px">` +
                        paragraphsHtml(block.text, ctx, `${base}font-size:14px;line-height:22px;color:${color};text-align:${side('start', ctx)}`, color) +
                        `</td></tr>`
                ),
                space: 24,
            }
        }
        case 'details': {
            const cell = `padding:12px 0;border-bottom:1px solid ${c.border};${base}font-size:14px;line-height:20px;vertical-align:top;`
            const rows = block.rows
                .map(
                    (row) =>
                        `<tr><td width="40%" style="${cell}color:${c.muted};text-align:${side('start', ctx)};padding-${ctx.rtl ? 'left' : 'right'}:12px">${inlineHtml(row.label, ctx)}</td>` +
                        `<td style="${cell}color:${c.text};font-weight:600;text-align:${side('end', ctx)}">${inlineHtml(row.value, ctx)}</td></tr>`
                )
                .join('')
            return { html: table(rows, ` style="border-top:1px solid ${c.border}"`), space: 24 }
        }
        case 'divider':
            return {
                html: table(`<tr><td style="padding:8px 0 0"><div style="border-top:1px solid ${c.border};height:1px;line-height:1px;font-size:1px">&nbsp;</div></td></tr>`),
                space: 24,
            }
        case 'spacer': {
            const height = block.size === 'sm' ? 8 : block.size === 'lg' ? 40 : 20
            return { html: `<div style="height:${height}px;line-height:${height}px;font-size:1px">&nbsp;</div>`, space: 0 }
        }
    }
}

function blockText(block: LocalBlock, ctx: Ctx): string {
    switch (block.type) {
        case 'heading':
            return inlineText(block.text, ctx)
        case 'text':
            return paragraphs(block.text)
                .map((p) => inlineText(p, ctx))
                .join('\n\n')
        case 'button': {
            const href = safeHref(block.url, ctx)
            return href ? `${inlineText(block.label, ctx)}: ${href}` : inlineText(block.label, ctx)
        }
        case 'code':
            return [block.label ? inlineText(block.label, ctx) : '', fill(block.value, ctx, (v) => v)].filter(Boolean).join('\n')
        case 'image':
            return block.alt ? inlineText(block.alt, ctx) : ''
        case 'note':
            return paragraphs(block.text)
                .map((p) => inlineText(p, ctx))
                .join('\n\n')
        case 'details':
            return block.rows.map((row) => `${inlineText(row.label, ctx)}: ${inlineText(row.value, ctx)}`).join('\n')
        case 'divider':
            return '──────────'
        case 'spacer':
            return ''
    }
}

export function render(input: RenderInput): RenderedMail {
    const theme = input.theme
    const colors = Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [k, cssValue((theme.colors as any)?.[k], v)])) as typeof COLORS
    const ctx: Ctx = {
        data: input.data,
        missing: new Set(),
        colors,
        font: input.rtl ? cssValue(theme.fontRtl, FONT_RTL) : cssValue(theme.font, FONT),
        radius: Math.max(0, Math.min(24, Number(theme.radius ?? 8) || 0)),
        rtl: input.rtl,
    }
    const dir = input.rtl ? 'rtl' : 'ltr'
    const t = (text: any) => localize(text, input.locale, input.fallbackLocale)

    const subject = fill(input.subject, ctx, (v) => v).replace(/\s+/g, ' ').trim()
    const preheader = fill(input.preheader ?? '', ctx, (v) => v).replace(/\s+/g, ' ').trim()
    const brand = t(theme.brandName)

    // ── HTML
    const blocks = input.blocks.map((block) => blockHtml(block, ctx)).filter((b) => b.html)
    const body = blocks.map((b, i) => `<tr><td style="padding:0 0 ${i === blocks.length - 1 ? 0 : b.space}px">${b.html}</td></tr>`).join('')

    const logoAlign = side(theme.logoAlign, ctx, 'center')
    const logoWidth = Math.max(24, Math.min(300, Number(theme.logoWidth ?? 120) || 120))
    const logoSrc = theme.logoUrl ? safeHref(theme.logoUrl, ctx) : ''
    const logo = logoSrc
        ? `<img src="${esc(logoSrc)}" width="${logoWidth}" alt="${esc(brand)}" style="display:block;${logoAlign === 'center' ? 'margin:0 auto;' : ''}width:${logoWidth}px;max-width:100%;height:auto;border:0">`
        : brand
          ? `<span style="font-family:${ctx.font};font-size:20px;line-height:28px;font-weight:700;color:${colors.text}">${esc(brand)}</span>`
          : ''

    const footerStyle = `font-family:${ctx.font};font-size:12px;line-height:18px;color:${colors.muted};text-align:center`
    const footerText = t(theme.footer)
    const links = (theme.links ?? [])
        .map((link) => ({ label: t(link.label), href: safeHref(link.url, ctx) }))
        .filter((link) => link.label && link.href)
    const notice = input.notice?.trim() ?? ''
    const footer =
        (footerText ? paragraphsHtml(footerText, ctx, footerStyle, colors.muted) : '') +
        (links.length
            ? `<p style="margin:${footerText ? 12 : 0}px 0 0;${footerStyle}">${links
                  .map((link) => `<a href="${esc(link.href)}" target="_blank" style="color:${colors.muted};text-decoration:underline">${esc(link.label)}</a>`)
                  .join(' &nbsp;·&nbsp; ')}</p>`
            : '') +
        (notice ? `<div style="margin:${footerText || links.length ? 16 : 0}px 0 0">${paragraphsHtml(notice, ctx, footerStyle, colors.muted)}</div>` : '')

    // What inboxes show after the subject; the filler keeps the email's first words out of it.
    const preview = preheader
        ? `<div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${colors.background};opacity:0">${esc(preheader)}${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>`
        : ''

    const html = `<!DOCTYPE html>
<html lang="${esc(input.locale)}" dir="${dir}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt}
img{-ms-interpolation-mode:bicubic}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
@media (max-width:620px){.eml-outer{padding:16px 8px!important}.eml-card{padding:28px 20px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:${colors.background}">
${preview}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${dir}" bgcolor="${colors.background}" style="background:${colors.background}">
<tr><td align="center" class="eml-outer" style="padding:32px 12px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">
${logo ? `<tr><td align="${logoAlign}" style="padding:0 8px 24px">${logo}</td></tr>` : ''}
<tr><td class="eml-card" bgcolor="${colors.card}" style="padding:40px 48px;background:${colors.card};border:1px solid ${colors.border};border-radius:${ctx.radius + 4}px">
${table(body)}
</td></tr>
${footer ? `<tr><td style="padding:24px 24px 0">${footer}</td></tr>` : ''}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`

    // ── Plain text
    const text = [
        brand,
        ...input.blocks.map((block) => blockText(block, ctx)),
        footerText ? '──────────\n' + paragraphs(footerText).map((p) => inlineText(p, ctx)).join('\n') : '',
        links.map((link) => `${link.label}: ${link.href}`).join('\n'),
        notice ? paragraphs(notice).map((p) => inlineText(p, ctx)).join('\n') : '',
    ]
        .map((part) => part.trim())
        .filter(Boolean)
        .join('\n\n')

    return { subject, preheader, html, text, locale: input.locale, dir, missing: [...ctx.missing] }
}
