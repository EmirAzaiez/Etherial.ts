import etherial from 'etherial'

import { Banner } from '../models/Banner.js'
import { Story } from '../models/Story.js'
import { StorySlide } from '../models/StorySlide.js'
import { ETHContentLeafConfig, featuresOf } from './options.js'

/** Each image column and the name of its association: what the back-office's media field includes. */
const IMAGES: [any, string, string][] = [
    [Banner, 'image', 'image_id'],
    [Story, 'cover', 'cover_id'],
    [StorySlide, 'image', 'image_id'],
]

/**
 * The project's media model, tied to the image columns: the back-office
 * shows the image, the media leaf keeps it while it is used. The leaf can't
 * import that model, the project extends it: done once the database runs.
 */
export function linkMedia(config: ETHContentLeafConfig): boolean {
    const name = config.mediaModel ?? 'Media'
    const Media = (etherial as any).database?.sequelize?.models?.[name]
    if (!Media) return false
    const features = featuresOf(config)
    for (const [Model, as, foreignKey] of IMAGES) {
        if (!features.includes(Model === Banner ? 'banners' : 'stories') || Model.associations[as]) continue
        Model.belongsTo(Media, { as, foreignKey, constraints: false })
    }
    return true
}

/**
 * The images the contents use, for the media leaf's orphan cleanup: it may
 * run before the media model is tied (a command), and would delete them.
 */
export async function usedMediaIds(config: ETHContentLeafConfig): Promise<number[]> {
    const features = featuresOf(config)
    const lists = await Promise.all(
        IMAGES.filter(([Model]) => features.includes(Model === Banner ? 'banners' : 'stories')).map(([Model, , column]) =>
            Model.findAll({ attributes: [column], raw: true }).then((rows: any[]) => rows.map((row) => row[column]))
        )
    )
    return lists.flat().filter((id): id is number => Number.isInteger(id))
}

/** The include of an image, once tied: without the media leaf the app gets no image, so nothing to show. */
export function mediaInclude(Model: any, as: string): any[] {
    return Model.associations?.[as] ? [{ association: as }] : []
}
