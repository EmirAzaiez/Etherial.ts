import { ETHContentLeafConfig } from './options.js';
/**
 * The project's media model, tied to the image columns: the back-office
 * shows the image, the media leaf keeps it while it is used. The leaf can't
 * import that model, the project extends it: done once the database runs.
 */
export declare function linkMedia(config: ETHContentLeafConfig): boolean;
/**
 * The images the contents use, for the media leaf's orphan cleanup: it may
 * run before the media model is tied (a command), and would delete them.
 */
export declare function usedMediaIds(config: ETHContentLeafConfig): Promise<number[]>;
/** The include of an image, once tied: without the media leaf the app gets no image, so nothing to show. */
export declare function mediaInclude(Model: any, as: string): any[];
