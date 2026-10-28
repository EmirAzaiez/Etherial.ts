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
import { coverOf } from './blocks.js';
// ──────────────────────────────────────────────────────────────────────────
// The photo across the top of a page: its record's cover (a news' image), a
// media of the media leaf. The page keeps its address, so that drawing it
// never reads the media table.
// ──────────────────────────────────────────────────────────────────────────
/** Its address on the web, when its folder is public-read; null otherwise. */
function mediaCover(id) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const Media = (_c = (_b = (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize) === null || _b === void 0 ? void 0 : _b.models) === null || _c === void 0 ? void 0 : _c.Media;
        const leaf = etherial.eth_media_leaf;
        if (!Media || !(leaf === null || leaf === void 0 ? void 0 : leaf.getPublicUrl))
            return null;
        const media = yield Media.findByPk(id).catch(() => null);
        const src = media ? leaf.getPublicUrl(media) : null;
        return src ? { src, media: id } : null;
    });
}
/**
 * A cover as a record or the back-office gives it: a media's id, a media,
 * an address, `{ src | url }`. Null when there is none, or none to show.
 */
export function coverFrom(value) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (value === null || value === undefined || value === '')
            return null;
        if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) {
            const id = Number(value);
            return Number.isInteger(id) && id > 0 ? mediaCover(id) : null;
        }
        if (typeof value === 'string')
            return coverOf({ src: value });
        if (typeof value !== 'object')
            return null;
        const v = value;
        if (typeof v.src === 'string' || typeof v.url === 'string')
            return coverOf({ src: (_a = v.src) !== null && _a !== void 0 ? _a : v.url, media: (_b = v.media) !== null && _b !== void 0 ? _b : v.id });
        return typeof v.id === 'number' ? mediaCover(v.id) : null;
    });
}
