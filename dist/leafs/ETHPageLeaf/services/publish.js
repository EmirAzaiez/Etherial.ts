var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from 'etherial';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { Op } from 'sequelize';
import { Page } from '../models/Page.js';
import { PageError, defaultLocaleOf, folderOf, localesOf, localize, rtlOf } from './options.js';
import { photoOf } from './blocks.js';
import { render } from './render.js';
import { resolveBlocks } from './resolve.js';
import { pageFonts, pageHead } from './settings.js';
import { state } from './state.js';
function mediaLeaf() {
    const media = etherial.eth_media_leaf;
    if (!(media === null || media === void 0 ? void 0 : media.s3) || !(media === null || media === void 0 ? void 0 : media.bucket))
        throw new PageError('Pages need the media leaf: their HTML and images go to its bucket.', 500);
    return media;
}
/** Where the bucket's public files are read from: the CDN, else the bucket itself. */
export function publicBase() {
    var _a;
    const media = mediaLeaf();
    if ((_a = media.config) === null || _a === void 0 ? void 0 : _a.cdn_url)
        return String(media.config.cdn_url).replace(/\/$/, '');
    return `${String(media.config.server).replace(/\/$/, '')}/${media.bucket}`;
}
export function keyOf(slug, locale) {
    return `${folderOf(state.config)}/${slug}/${locale}.html`;
}
/** The languages with blocks of their own, the default one first (always: a page has at least it). */
export function writtenLocales(blocks) {
    const locales = localesOf(state.config);
    const written = locales.filter((l) => { var _a; return (_a = blocks === null || blocks === void 0 ? void 0 : blocks[l]) === null || _a === void 0 ? void 0 : _a.length; });
    return written.length ? written : [locales[0]];
}
export function pageIn(page, asked) {
    var _a, _b, _c, _d, _e, _f;
    const config = state.config;
    const fallback = defaultLocaleOf(config);
    const locales = localesOf(config);
    const own = locales.includes(asked) && ((_b = (_a = page.blocks) === null || _a === void 0 ? void 0 : _a[asked]) === null || _b === void 0 ? void 0 : _b.length);
    // A language without blocks reads the default one: a title in Arabic over English blocks would be half a page.
    const locale = own ? asked : ((_c = writtenLocales(page.blocks)[0]) !== null && _c !== void 0 ? _c : fallback);
    const title = localize(page.title, locale, fallback);
    return {
        locale,
        dir: rtlOf(config, locale) ? 'rtl' : 'ltr',
        title,
        summary: localize(page.summary, locale, fallback),
        blocks: resolveBlocks((_e = (_d = page.blocks) === null || _d === void 0 ? void 0 : _d[locale]) !== null && _e !== void 0 ? _e : [], { locale, title, timezone: config.timezone, mapsKey: (_f = config.maps) === null || _f === void 0 ? void 0 : _f.key }),
    };
}
function put(key, html, cacheControl) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (cacheControl === void 0) { cacheControl = (_a = state.config.cacheControl) !== null && _a !== void 0 ? _a : 'public, max-age=60'; }
        const media = mediaLeaf();
        yield media.s3.send(new PutObjectCommand({
            Bucket: media.bucket,
            Key: key,
            Body: html,
            ContentType: 'text/html; charset=utf-8',
            CacheControl: cacheControl,
            ACL: 'public-read',
        }));
    });
}
function keysOf(page) {
    var _a;
    if (!(page === null || page === void 0 ? void 0 : page.published_slug))
        return [];
    const locales = new Set([...localesOf(state.config), ...Object.keys((_a = page.html) !== null && _a !== void 0 ? _a : {})]);
    return [...locales].map((l) => keyOf(page.published_slug, l));
}
/** Every language of the page, rendered as the bucket gets it. */
export function renderAll(page) {
    const config = state.config;
    const fallback = defaultLocaleOf(config);
    const base = publicBase();
    const locales = writtenLocales(page.blocks);
    const languages = locales.map((l) => ({ locale: l, href: `${l}.html` }));
    const fonts = pageFonts();
    const head = pageHead(page.head);
    return locales.map((locale) => {
        var _a, _b, _c;
        const content = pageIn(page, locale);
        const key = keyOf(page.slug, locale);
        const url = `${base}/${key}`;
        const html = render(Object.assign(Object.assign({}, content), { rtl: content.dir === 'rtl', theme: (_a = config.theme) !== null && _a !== void 0 ? _a : {}, brand: localize((_b = config.theme) === null || _b === void 0 ? void 0 : _b.brandName, locale, fallback), 
            // Next to this one in the bucket, in the same language.
            pageHref: (slug) => `../${slug}/${locale}.html`, languages, canonical: url, timezone: config.timezone, fonts,
            head, cover: photoOf(page), logo: (_c = page.logo) !== null && _c !== void 0 ? _c : null, maps: config.maps }));
        return { locale, key, url, html };
    });
}
/**
 * Puts the page's HTML where it belongs before the row is saved: the columns
 * to save with it, and the files of its old address to take down once it is.
 * A bucket that refuses fails the save, so the back-office never shows a page
 * as published while the web has the old one.
 */
export function publish(next, previous) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const files = next.published ? renderAll(next) : [];
        yield Promise.all(files.map((f) => put(f.key, f.html)));
        const kept = new Set(files.map((f) => f.key));
        return {
            columns: {
                html: Object.fromEntries(files.map((f) => [f.locale, f.url])),
                published_slug: next.published ? next.slug : null,
                published_at: next.published ? ((previous === null || previous === void 0 ? void 0 : previous.published) ? ((_a = previous.published_at) !== null && _a !== void 0 ? _a : new Date()) : new Date()) : null,
            },
            stale: keysOf(previous).filter((key) => !kept.has(key)),
        };
    });
}
/**
 * Files no page uses any more, deleted in the background: a slow bucket holds
 * neither a save nor a delete. A failure only leaves a file behind (the media
 * leaf logs it).
 */
export function takeDown(keys) {
    if (!keys.length)
        return;
    const media = etherial.eth_media_leaf;
    if (!(media === null || media === void 0 ? void 0 : media.deleteFile))
        return;
    void Promise.all(keys.map((key) => media.deleteFile(key)));
}
/** A page deleted: its files go, its preview link says it no longer works. */
export function takeDownPage(page) {
    takeDown(keysOf(page));
    if (page.preview_key)
        retirePreview(page.preview_key).catch((err) => { var _a; return console.error('[ETHPageLeaf] A preview link could not be stopped:', (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err); });
}
// ── The preview link
/** A draft says so above it, in its language: the link may be forwarded. */
const NOTICE = {
    en: 'Preview: this page is not published. Only people with this link can see it.',
    ar: 'معاينة: هذه الصفحة غير منشورة، ولا يراها إلا من لديه هذا الرابط.',
    fr: 'Aperçu : cette page n’est pas publiée. Seules les personnes qui ont ce lien la voient.',
};
const GONE = {
    en: ['This link no longer works', 'Ask the person who sent it for a new one.'],
    ar: ['هذا الرابط لم يعد يعمل', 'اطلب رابطاً جديداً ممن أرسله إليك.'],
    fr: ['Ce lien ne marche plus', 'Demandez-en un nouveau à la personne qui vous l’a envoyé.'],
};
/** Read again on every visit: whoever has the link sees the last save. */
const PREVIEW_CACHE = 'no-store';
export function previewKeyOf(key, locale) {
    return `${folderOf(state.config)}/preview/${key}/${locale}.html`;
}
/**
 * The page under its preview link as saved, in every language of the project
 * (one it isn't written in reads the default one): a line above a draft says
 * so, search engines are kept out.
 */
function renderPreview(page, key) {
    const config = state.config;
    const fallback = defaultLocaleOf(config);
    const languages = writtenLocales(page.blocks).map((l) => ({ locale: l, href: `${l}.html` }));
    const fonts = pageFonts();
    const head = pageHead(page.head);
    return localesOf(config).map((asked) => {
        var _a, _b, _c, _d;
        const content = pageIn(page, asked);
        const lang = content.locale.split('-')[0];
        return {
            key: previewKeyOf(key, asked),
            html: render(Object.assign(Object.assign({}, content), { rtl: content.dir === 'rtl', theme: (_a = config.theme) !== null && _a !== void 0 ? _a : {}, brand: localize((_b = config.theme) === null || _b === void 0 ? void 0 : _b.brandName, content.locale, fallback), 
                // Another page opens where it is on the web.
                pageHref: (slug) => `../../${slug}/${content.locale}.html`, languages, timezone: config.timezone, fonts,
                head, cover: photoOf(page), logo: (_c = page.logo) !== null && _c !== void 0 ? _c : null, maps: config.maps, unlisted: true, notice: page.published ? undefined : ((_d = NOTICE[lang]) !== null && _d !== void 0 ? _d : NOTICE.en) })),
        };
    });
}
/** The page written under its preview link: when the link is made, and on each save after. */
export function putPreview(page, key) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all(renderPreview(page, key).map((f) => put(f.key, f.html, PREVIEW_CACHE)));
    });
}
/** A preview link stopped: its files say it no longer works, in their language. */
export function retirePreview(key) {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all(localesOf(state.config).map((l) => put(previewKeyOf(key, l), goneHtml(l), PREVIEW_CACHE)));
    });
}
function goneHtml(locale) {
    var _a;
    const lang = locale.split('-')[0];
    const [title, text] = (_a = GONE[lang]) !== null && _a !== void 0 ? _a : GONE.en;
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    return `<!DOCTYPE html>
<html lang="${GONE[lang] ? lang : 'en'}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Tahoma,Arial,sans-serif;color:#111827;text-align:center}h1{margin:0;font-size:22px}p{margin:8px 0 0;color:#6B7280}</style>
</head>
<body><div><h1>${title}</h1><p>${text}</p></div></body>
</html>
`;
}
/** Every published page written into the bucket again, and every preview link: after a change of theme or of fonts. */
export function republishAll() {
    return __awaiter(this, void 0, void 0, function* () {
        const pages = yield Page.findAll({ where: { published: true } });
        for (const page of pages) {
            const row = page.get({ plain: true });
            const { columns, stale } = yield publish(row, row);
            yield page.update(columns);
            takeDown(stale);
        }
        const shared = yield Page.findAll({ where: { preview_key: { [Op.ne]: null } } });
        for (const page of shared)
            yield putPreview(page.get({ plain: true }), page.preview_key);
        return pages.length;
    });
}
// Changes in a row (both fonts picked one after the other) are written once.
let timer = null;
let running = false;
let again = false;
/** `republishAll` in a few seconds, in the background: what the back-office's settings call when they change. */
export function republishSoon(why) {
    if (timer)
        clearTimeout(timer);
    timer = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
        var _a;
        timer = null;
        if (running)
            return void (again = true);
        running = true;
        try {
            const count = yield republishAll();
            console.log(`[ETHPageLeaf] ${why}: ${count} published page${count === 1 ? '' : 's'} written again`);
        }
        catch (err) {
            console.error(`[ETHPageLeaf] ${why}: the pages could not be written again:`, (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : err);
        }
        finally {
            running = false;
            if (again) {
                again = false;
                republishSoon(why);
            }
        }
    }), 3000);
}
