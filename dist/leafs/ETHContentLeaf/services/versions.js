var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { AppRelease } from '../models/AppRelease.js';
import { PLATFORMS, compareVersions, localize, parseVersion } from './options.js';
import { languages, state } from './state.js';
/** The leaf's texts, when the team wrote none. */
const TEXTS = {
    en: {
        update: { title: 'A new version is available', message: 'Update the app to get the latest features.' },
        required: { title: 'Update required', message: 'This version of the app is no longer supported. Update it to keep using it.' },
    },
    ar: {
        update: { title: 'يتوفر إصدار جديد', message: 'حدّث التطبيق للحصول على أحدث الميزات.' },
        required: { title: 'التحديث مطلوب', message: 'هذا الإصدار من التطبيق لم يعد مدعومًا. حدّثه لمتابعة استخدامه.' },
    },
    fr: {
        update: { title: 'Une nouvelle version est disponible', message: "Mettez l'application à jour pour profiter des dernières nouveautés." },
        required: { title: 'Mise à jour requise', message: "Cette version de l'application n'est plus prise en charge. Mettez-la à jour pour continuer." },
    },
};
export function platformOf(value) {
    const platform = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return PLATFORMS.includes(platform) ? platform : null;
}
/** Whether an app at `version` asks for `release`: a required one blocks, a banner asks, `auto` asks for a new major version. */
function promptOf(release, version) {
    var _a, _b;
    if (release.prompt === 'required')
        return 'required';
    if (release.prompt === 'banner')
        return 'banner';
    return ((_a = parseVersion(release.version)[0]) !== null && _a !== void 0 ? _a : 0) > ((_b = parseVersion(version)[0]) !== null && _b !== void 0 ? _b : 0) ? 'banner' : 'available';
}
const RANK = { none: 0, available: 1, banner: 2, required: 3 };
/**
 * What the app at `version` on `platform` does, and what it shows, in
 * `locale`. Each newer published version has its say; the strongest wins,
 * and its texts with it (the newest of them).
 */
export function appUpdateOf(platform, version, locale) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const releases = (yield AppRelease.findAll({ where: { platform, published: true } })).sort((a, b) => compareVersions(b.version, a.version));
        const store_url = ((_a = state.config.stores) === null || _a === void 0 ? void 0 : _a[platform]) || null;
        const answer = {
            platform,
            version: version !== null && version !== void 0 ? version : null,
            latest: (_c = (_b = releases[0]) === null || _b === void 0 ? void 0 : _b.version) !== null && _c !== void 0 ? _c : null,
            minimum: (_e = (_d = releases.find((r) => r.prompt === 'required')) === null || _d === void 0 ? void 0 : _d.version) !== null && _e !== void 0 ? _e : null,
            update: null,
            store_url,
            title: null,
            message: null,
        };
        if (!version || !parseVersion(version))
            return answer;
        const newer = releases.filter((r) => compareVersions(r.version, version) > 0).map((release) => ({ release, kind: promptOf(release, version) }));
        const update = newer.reduce((strongest, { kind }) => (RANK[kind] > RANK[strongest] ? kind : strongest), 'none');
        answer.update = update;
        // A newer minor version shows nothing: no texts.
        if (update === 'none' || update === 'available')
            return answer;
        // The newest of the versions that ask the same, among those the team wrote a text for.
        const speakers = newer.filter((n) => n.kind === update).map((n) => n.release);
        const leaf = (_f = TEXTS[locale]) === null || _f === void 0 ? void 0 : _f[update === 'required' ? 'required' : 'update'];
        const textOf = (field) => {
            var _a;
            const written = (_a = speakers.find((r) => { var _a; return Object.keys((_a = r[field]) !== null && _a !== void 0 ? _a : {}).length; })) === null || _a === void 0 ? void 0 : _a[field];
            // In the app's language: the team's, else the leaf's, else the team's in another language.
            return (written === null || written === void 0 ? void 0 : written[locale]) || (leaf === null || leaf === void 0 ? void 0 : leaf[field]) || localize(written, locale, languages().default) || TEXTS.en[update === 'required' ? 'required' : 'update'][field];
        };
        answer.title = textOf('title');
        answer.message = textOf('message');
        return answer;
    });
}
