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
import { Banner } from '../models/Banner.js';
import { Story } from '../models/Story.js';
import { StorySlide } from '../models/StorySlide.js';
import { featuresOf } from './options.js';
/** Each image column and the name of its association: what the back-office's media field includes. */
const IMAGES = [
    [Banner, 'image', 'image_id'],
    [Story, 'cover', 'cover_id'],
    [StorySlide, 'image', 'image_id'],
];
/**
 * The project's media model, tied to the image columns: the back-office
 * shows the image, the media leaf keeps it while it is used. The leaf can't
 * import that model, the project extends it: done once the database runs.
 */
export function linkMedia(config) {
    var _a, _b, _c, _d;
    const name = (_a = config.mediaModel) !== null && _a !== void 0 ? _a : 'Media';
    const Media = (_d = (_c = (_b = etherial.database) === null || _b === void 0 ? void 0 : _b.sequelize) === null || _c === void 0 ? void 0 : _c.models) === null || _d === void 0 ? void 0 : _d[name];
    if (!Media)
        return false;
    const features = featuresOf(config);
    for (const [Model, as, foreignKey] of IMAGES) {
        if (!features.includes(Model === Banner ? 'banners' : 'stories') || Model.associations[as])
            continue;
        Model.belongsTo(Media, { as, foreignKey, constraints: false });
    }
    return true;
}
/**
 * The images the contents use, for the media leaf's orphan cleanup: it may
 * run before the media model is tied (a command), and would delete them.
 */
export function usedMediaIds(config) {
    return __awaiter(this, void 0, void 0, function* () {
        const features = featuresOf(config);
        const lists = yield Promise.all(IMAGES.filter(([Model]) => features.includes(Model === Banner ? 'banners' : 'stories')).map(([Model, , column]) => Model.findAll({ attributes: [column], raw: true }).then((rows) => rows.map((row) => row[column]))));
        return lists.flat().filter((id) => Number.isInteger(id));
    });
}
/** The include of an image, once tied: without the media leaf the app gets no image, so nothing to show. */
export function mediaInclude(Model, as) {
    var _a;
    return ((_a = Model.associations) === null || _a === void 0 ? void 0 : _a[as]) ? [{ association: as }] : [];
}
