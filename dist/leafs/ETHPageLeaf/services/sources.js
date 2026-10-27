var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { PageError } from './options.js';
export const MAX_LINKS = 3;
export const MAX_DOCUMENTS = 2;
/** All the PDFs together, base64: the API takes 32 MB per request, screenshots and words included. */
const MAX_DOCUMENTS_SIZE = 20 * 1024 * 1024;
/** A page or a PDF downloaded from a link. */
const MAX_DOWNLOAD = 15 * 1024 * 1024;
const TIMEOUT = 15000;
const MAX_REDIRECTS = 5;
/** About 10 000 tokens: a long article, without the rest of the site. */
const MAX_TEXT = 40000;
const MAX_IMAGES = 40;
/** A site that answers a robot with a challenge page answers a browser with the page. */
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
/** The links to read, as the back-office sends them: https or http, each once. */
export function cleanLinks(value) {
    if (!Array.isArray(value) || !value.length)
        return [];
    const links = [...new Set(value.filter((v) => typeof v === 'string').map((v) => v.trim()).filter(Boolean))];
    if (links.length > MAX_LINKS)
        throw new PageError(`${MAX_LINKS} links at most.`);
    for (const link of links) {
        let url;
        try {
            url = new URL(link);
        }
        catch (_a) {
            throw new PageError(`${link.slice(0, 80)} is not a link to a page.`);
        }
        if (url.protocol !== 'https:' && url.protocol !== 'http:')
            throw new PageError(`${link.slice(0, 80)}: only a web page's link (https://…) can be read.`);
    }
    return links;
}
/** The PDFs, as the back-office sends them: `[{ name, data }]`, data a data: URL or the base64 alone. */
export function cleanDocuments(value) {
    if (!Array.isArray(value) || !value.length)
        return [];
    if (value.length > MAX_DOCUMENTS)
        throw new PageError(`${MAX_DOCUMENTS} PDFs at most.`);
    const documents = value.map((doc) => {
        var _a, _b;
        const url = typeof (doc === null || doc === void 0 ? void 0 : doc.data) === 'string' ? /^data:([^;,]+);base64,([^]*)$/.exec(doc.data) : null;
        const mediaType = String((_b = (_a = url === null || url === void 0 ? void 0 : url[1]) !== null && _a !== void 0 ? _a : doc === null || doc === void 0 ? void 0 : doc.mediaType) !== null && _b !== void 0 ? _b : 'application/pdf').toLowerCase();
        const data = url ? url[2] : typeof (doc === null || doc === void 0 ? void 0 : doc.data) === 'string' ? doc.data : '';
        const name = (typeof (doc === null || doc === void 0 ? void 0 : doc.name) === 'string' && doc.name.trim().slice(0, 120)) || 'document.pdf';
        if (mediaType !== 'application/pdf')
            throw new PageError(`${name} is not a PDF.`);
        // A PDF starts with "%PDF": "JVBERi" in base64.
        if (!data.startsWith('JVBERi') || !/^[A-Za-z0-9+/]+=*$/.test(data.slice(0, 200)))
            throw new PageError(`${name} could not be read: it is not a PDF.`);
        return { name, data };
    });
    if (documents.reduce((size, doc) => size + doc.data.length, 0) > MAX_DOCUMENTS_SIZE)
        throw new PageError('The PDFs are too large: 15 MB at most together.');
    return documents;
}
// ── Opening a link ────────────────────────────────────────────────────────
function privateAddress(ip) {
    if (isIP(ip) === 4) {
        const [a, b] = ip.split('.').map(Number);
        return (a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 100 && b >= 64 && b <= 127) ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 198 && (b === 18 || b === 19)) ||
            a >= 224);
    }
    const v6 = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
    if (mapped)
        return privateAddress(mapped[1]);
    return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith('ff');
}
/** Only a public site is opened: never the server's own network, its cloud's metadata. */
function checkPublic(url) {
    return __awaiter(this, void 0, void 0, function* () {
        if (url.protocol !== 'https:' && url.protocol !== 'http:')
            throw new PageError(`${url.href.slice(0, 80)}: only a web page's link (https://…) can be read.`, 422);
        if (url.username || url.password)
            throw new PageError('A link with a password in it cannot be read.', 422);
        const host = url.hostname.replace(/^\[|\]$/g, '');
        const addresses = isIP(host) ? [host] : (yield lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
        if (!addresses.length)
            throw new PageError(`${host} could not be found: check the link.`, 422);
        if (addresses.some(privateAddress))
            throw new PageError(`${host} is not a public website: only a page on the web can be read.`, 422);
    });
}
function download(link, signal) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
        var _d, _e, _f;
        let url = new URL(link);
        const timeout = AbortSignal.timeout(TIMEOUT);
        const both = signal ? AbortSignal.any([signal, timeout]) : timeout;
        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
            yield checkPublic(url);
            let response;
            try {
                response = yield fetch(url, {
                    redirect: 'manual',
                    signal: both,
                    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5', 'accept-language': 'en,ar;q=0.8' },
                });
            }
            catch (_g) {
                if (signal === null || signal === void 0 ? void 0 : signal.aborted)
                    throw new PageError('Stopped.', 499);
                if (timeout.aborted)
                    throw new PageError(`${url.hostname} took too long to answer. Try again, or send a screenshot of the page.`, 422);
                throw new PageError(`${url.hostname} could not be reached: check the link.`, 422);
            }
            const location = response.headers.get('location');
            if (response.status >= 300 && response.status < 400 && location) {
                yield ((_d = response.body) === null || _d === void 0 ? void 0 : _d.cancel().catch(() => undefined));
                url = new URL(location, url);
                continue;
            }
            if (!response.ok || !response.body) {
                yield ((_e = response.body) === null || _e === void 0 ? void 0 : _e.cancel().catch(() => undefined));
                const why = response.status === 404 || response.status === 410
                    ? 'the page is not there'
                    : response.status === 401 || response.status === 403
                        ? 'the site does not let it be read'
                        : `it answered ${response.status}`;
                throw new PageError(`${url.hostname}${url.pathname === '/' ? '' : url.pathname} could not be read: ${why}. Check the link, or send a screenshot of the page.`, 422);
            }
            const chunks = [];
            let size = 0;
            try {
                try {
                    for (var _h = true, _j = (e_1 = void 0, __asyncValues(response.body)), _k; _k = yield _j.next(), _a = _k.done, !_a; _h = true) {
                        _c = _k.value;
                        _h = false;
                        const chunk = _c;
                        size += chunk.length;
                        if (size > MAX_DOWNLOAD) {
                            yield response.body.cancel().catch(() => undefined);
                            throw new PageError(`${url.hostname} sent more than 15 MB: too large to read.`, 422);
                        }
                        chunks.push(Buffer.from(chunk));
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_h && !_a && (_b = _j.return)) yield _b.call(_j);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
            catch (err) {
                if (err instanceof PageError)
                    throw err;
                if (signal === null || signal === void 0 ? void 0 : signal.aborted)
                    throw new PageError('Stopped.', 499);
                throw new PageError(`${url.hostname} took too long to answer. Try again, or send a screenshot of the page.`, 422);
            }
            return { url, type: ((_f = response.headers.get('content-type')) !== null && _f !== void 0 ? _f : '').toLowerCase(), body: Buffer.concat(chunks) };
        }
        throw new PageError(`${new URL(link).hostname} sends the link elsewhere too many times.`, 422);
    });
}
/**
 * Opens a link: a web page is read into a `PageSource`, a PDF comes back as
 * a document to send as it is. Throws a PageError saying what to do when it
 * can't be read (not found, not public, a page drawn by scripts only).
 */
export function readLink(link, signal) {
    return __awaiter(this, void 0, void 0, function* () {
        const { url, type, body } = yield download(link, signal);
        if (type.includes('application/pdf') || body.subarray(0, 5).toString('latin1') === '%PDF-') {
            const name = decodeURIComponent(url.pathname.split('/').pop() || '') || `${url.hostname}.pdf`;
            return { document: { name, data: body.toString('base64') } };
        }
        if (type && !/html|xml|text\/plain/.test(type))
            throw new PageError(`${url.hostname}: this link is a file (${type.split(';')[0]}), not a page. Send a PDF or a screenshot instead.`, 422);
        const html = decodeHtml(body, type);
        const page = readablePage(html, url);
        const words = page.text.replace(/!?\[[^\]]*\]\([^)]*\)/g, ' ').replace(/[#\s-]+/g, ' ').trim();
        if (words.length < 150 && page.images.length < 2) {
            throw new PageError(`${url.hostname} shows almost nothing without a browser: send a screenshot of the page, or its PDF, instead.`, 422);
        }
        return { page };
    });
}
function decodeHtml(body, type) {
    var _a, _b, _c, _d;
    const declared = (_d = (_b = (_a = /charset=["']?([\w-]+)/i.exec(type)) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : (_c = /<meta[^>]+charset=["']?([\w-]+)/i.exec(body.subarray(0, 4096).toString('latin1'))) === null || _c === void 0 ? void 0 : _c[1]) !== null && _d !== void 0 ? _d : 'utf-8';
    try {
        return new TextDecoder(declared.toLowerCase()).decode(body);
    }
    catch (_e) {
        return new TextDecoder('utf-8').decode(body);
    }
}
// ── Reading a page ────────────────────────────────────────────────────────
const ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
    laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™', euro: '€', pound: '£', middot: '·', bull: '•', times: '×', deg: '°', shy: '',
};
function decodeEntities(text) {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity) => {
        var _a, _b;
        if (entity[0] === '#') {
            const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
            return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
        }
        return (_b = (_a = ENTITIES[entity]) !== null && _a !== void 0 ? _a : ENTITIES[entity.toLowerCase()]) !== null && _b !== void 0 ? _b : whole;
    });
}
function attrOf(tag, name) {
    var _a, _b, _c;
    const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
    return m ? decodeEntities((_c = (_b = (_a = m[1]) !== null && _a !== void 0 ? _a : m[2]) !== null && _b !== void 0 ? _b : m[3]) !== null && _c !== void 0 ? _c : '').trim() : '';
}
function absolute(href, base) {
    try {
        return new URL(href, base).href;
    }
    catch (_a) {
        return '';
    }
}
/** An image's best address: the widest of its srcset up to 2048 px, https. '' for an icon, a pixel, a vector. */
function imageSrc(tag, base) {
    var _a, _b;
    const srcset = attrOf(tag, 'data-srcset') || attrOf(tag, 'data-lazy-srcset') || attrOf(tag, 'srcset');
    let best = '';
    let bestWidth = 0;
    for (const candidate of srcset.split(/,\s+/)) {
        const [href, size] = candidate.trim().split(/\s+/);
        const width = Number((_b = (_a = /^(\d+)w$/.exec(size !== null && size !== void 0 ? size : '')) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : 0);
        if (href && width <= 2048 && width >= bestWidth) {
            best = href;
            bestWidth = width;
        }
    }
    const given = best || attrOf(tag, 'data-src') || attrOf(tag, 'data-lazy-src') || attrOf(tag, 'data-original') || attrOf(tag, 'src');
    if (!given || given.startsWith('data:'))
        return '';
    const width = Number(attrOf(tag, 'width')) || 0;
    const height = Number(attrOf(tag, 'height')) || 0;
    if (width && height && width < 120 && height < 120)
        return '';
    const src = absolute(given, base).replace(/^http:\/\//i, 'https://');
    if (!/^https:\/\//i.test(src) || /\.svg(\?|#|$)/i.test(src))
        return '';
    return src;
}
/**
 * Whether the page draws this picture itself (an `<img>`, a background), at any
 * of its sizes: WordPress names them photo-1024x445.jpg, photo-scaled.jpg.
 */
function showsPicture(html, src) {
    var _a, _b, _c;
    const stem = ((_a = src.split(/[?#]/)[0].split('/').pop()) !== null && _a !== void 0 ? _a : '').replace(/\.\w+$/, '').replace(/-(scaled|\d+x\d+)$/i, '');
    if (stem.length < 4)
        return true;
    const body = (_c = (_b = /<body\b[^>]*>([\s\S]*)<\/body\s*>/i.exec(html)) === null || _b === void 0 ? void 0 : _b[1]) !== null && _c !== void 0 ? _c : html;
    return body.replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ').includes(stem);
}
/**
 * A page's content as Markdown, and its pictures: the site's `<main>` (or
 * its article, or its body without header and footer), without what is
 * not the page (scripts, menus, forms, sidebars, pop-ups). A line the
 * site repeats (a desktop and a phone version of a section) comes once.
 */
export function readablePage(html, pageUrl) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const baseHref = attrOf((_b = (_a = /<base\b[^>]*>/i.exec(html)) === null || _a === void 0 ? void 0 : _a[0]) !== null && _b !== void 0 ? _b : '', 'href');
    const base = baseHref ? new URL(absolute(baseHref, pageUrl) || pageUrl.href) : pageUrl;
    const metas = (_c = html.match(/<meta\b[^>]*>/gi)) !== null && _c !== void 0 ? _c : [];
    const meta = (key) => {
        for (const tag of metas)
            if ((attrOf(tag, 'property') || attrOf(tag, 'name')).toLowerCase() === key)
                return attrOf(tag, 'content');
        return '';
    };
    const title = meta('og:title') || decodeEntities((_e = (_d = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)) === null || _d === void 0 ? void 0 : _d[1]) !== null && _e !== void 0 ? _e : '').replace(/\s+/g, ' ').trim();
    const description = meta('og:description') || meta('description');
    const clean = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template|canvas|select|textarea|button|object)\b[\s\S]*?<\/\1\s*>/gi, ' ');
    const main = (_g = (_f = /<main\b[^>]*>([\s\S]*?)<\/main\s*>/i.exec(clean)) === null || _f === void 0 ? void 0 : _f[1]) !== null && _g !== void 0 ? _g : (_h = /<article\b[^>]*>([\s\S]*)<\/article\s*>/i.exec(clean)) === null || _h === void 0 ? void 0 : _h[1];
    let content = main !== null && main !== void 0 ? main : ((_k = (_j = /<body\b[^>]*>([\s\S]*)<\/body\s*>/i.exec(clean)) === null || _j === void 0 ? void 0 : _j[1]) !== null && _k !== void 0 ? _k : clean).replace(/<header\b[\s\S]*?<\/header\s*>/gi, ' ');
    content = content.replace(/<(nav|form|aside|dialog|footer)\b[\s\S]*?<\/\1\s*>/gi, ' ');
    const images = [];
    const cover = absolute(meta('og:image'), base).replace(/^http:\/\//i, 'https://');
    if (/^https:\/\//i.test(cover) && !/\.svg(\?|#|$)/i.test(cover))
        images.push(cover);
    const markdown = content
        // A video a page builder starts with a script (Elementor's video widget): its link, in the widget's settings.
        .replace(/<[a-z][^>]*\sdata-settings\s*=\s*"[^"]*(?:youtube|vimeo)_url[^"]*"[^>]*>/gi, (tag) => {
        var _a, _b, _c, _d, _e;
        const settings = attrOf(tag, 'data-settings');
        const type = (_b = (_a = /"video_type"\s*:\s*"(\w+)"/.exec(settings)) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : 'youtube';
        const src = (_e = (_d = (_c = new RegExp(`"${type}_url"\\s*:\\s*"([^"]+)"`).exec(settings)) === null || _c === void 0 ? void 0 : _c[1]) === null || _d === void 0 ? void 0 : _d.replace(/\\\//g, '/')) !== null && _e !== void 0 ? _e : '';
        return /^https:\/\/([\w-]+\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i.test(src) ? `${tag}\nVideo: ${src}\n` : tag;
    })
        // A video from YouTube or Vimeo: its link.
        .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>|<iframe\b[^>]*>/gi, (tag) => {
        const src = absolute(attrOf(tag, 'data-src') || attrOf(tag, 'src'), base);
        return /youtube\.com|youtu\.be|vimeo\.com/i.test(src) ? `\nVideo: ${src}\n` : ' ';
    })
        // A video file the page plays (its src, or its first <source>): its link.
        .replace(/<video\b[^>]*>[\s\S]*?<\/video\s*>|<video\b[^>]*>/gi, (tag) => {
        const src = absolute(attrOf(tag, 'src'), base).replace(/^http:\/\//i, 'https://');
        return /^https:\/\//i.test(src) ? `\nVideo: ${src}\n` : ' ';
    })
        .replace(/<img\b[^>]*>/gi, (tag) => {
        const src = imageSrc(tag, base);
        if (!src)
            return ' ';
        if (!images.includes(src) && images.length < MAX_IMAGES)
            images.push(src);
        return images.includes(src) ? `\n![${attrOf(tag, 'alt').replace(/[[\]]/g, '')}](${src})\n` : ' ';
    })
        .replace(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi, (_whole, attrs, inner) => {
        const href = attrOf(` ${attrs}`, 'href');
        const link = /^(mailto|tel):/i.test(href) ? href : /^#|^javascript:/i.test(href) || !href ? '' : absolute(href, base);
        const text = inner.replace(/<(?!\/?(img)\b)[^>]+>/gi, ' ');
        return link && /^(https?|mailto|tel):/i.test(link) && text.trim() ? `[${text.trim()}](${link})` : inner;
    })
        .replace(/<h([1-6])\b[^>]*>/gi, (_w, level) => `\n\n${'#'.repeat(Number(level))} `)
        .replace(/<\/h[1-6]\s*>/gi, '\n\n')
        .replace(/<li\b[^>]*>/gi, '\n- ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(p|div|section|article|header|figure|figcaption|blockquote|table|tr|ul|ol|dl|dt|dd|address|main|span\s+class="[^"]*elementor-icon-list-text)\b[^>]*>/gi, '\n')
        .replace(/<\/?(td|th)\b[^>]*>/gi, ' ')
        .replace(/<[^>]+>/g, '');
    const lines = [];
    const seen = new Set();
    let size = 0;
    let cut = false;
    for (const raw of decodeEntities(markdown).split('\n')) {
        const line = raw.replace(/[ \t ]+/g, ' ').trim();
        if (!line || line === '-')
            continue;
        // "- " alone, its words on the next line: one line.
        if (lines[lines.length - 1] === '-')
            lines.pop();
        const key = line.toLowerCase();
        if ((line.length >= 20 || line.startsWith('![')) && seen.has(key))
            continue;
        seen.add(key);
        if (size + line.length > MAX_TEXT) {
            cut = true;
            break;
        }
        size += line.length + 1;
        lines.push(line.startsWith('#') ? `\n${line}` : line);
    }
    // The site's share picture is the page's cover only when the page shows it
    // too (a banner drawn as a background) or has no picture of its own: else
    // it is just the thumbnail of a shared link, a banner the page doesn't have.
    const coverShown = images[0] === cover && (images.length === 1 || showsPicture(html, cover));
    if (images[0] === cover && !coverShown)
        images.shift();
    let text = lines.join('\n').trim();
    // The site's summary of the page, when the page doesn't already start with it.
    const summary = description.replace(/\s*(\[…\]|\.\.\.|…)$/, '');
    const words = (t) => t.toLowerCase().replace(/!?\[[^\]]*\]\([^)]*\)/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (summary && !words(text).includes(words(summary).slice(0, 60)))
        text = `${summary}\n\n${text}`;
    // The cover, when it is one: first, where Claude reads it.
    if (coverShown && !text.includes(`(${cover})`))
        text = `![${title.replace(/[[\]]/g, '')}](${cover})\n\n${text}`;
    if (cut)
        text += '\n\n(The page goes on; the rest was left out.)';
    return { url: pageUrl.href, title, text, images };
}
