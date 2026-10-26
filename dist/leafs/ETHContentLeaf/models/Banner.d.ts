import { Model } from 'etherial/components/database/provider';
import { Audience } from '../services/options.js';
/**
 * A slide of the home screen's carousel: an image, words on it if need be,
 * and where a tap goes. `image` is the project's media row (an association
 * the leaf adds at boot).
 */
export declare class Banner extends Model<Banner> {
    id: number;
    image_id: number;
    image?: any;
    /** `{ en, ar }`, on the image. Empty: the image alone. */
    title: Record<string, string>;
    subtitle: Record<string, string>;
    /** The button's words, `{ en: 'Discover' }`. Empty: the whole banner is the link. */
    button: Record<string, string>;
    /** `https://…`, or a link of the app's own (its routes). Empty: nothing opens. */
    link: string | null;
    /** The title in the default language: the back-office's lists and search. Written by the leaf. */
    label: string;
    audience: Audience;
    /** Shown from then. Empty: as soon as it is published. */
    starts_at: Date | null;
    /** Hidden from then. Empty: until it is unpublished. */
    ends_at: Date | null;
    position: number;
    /** Off: a draft, the app doesn't see it. */
    published: boolean;
    created_at: Date;
    updated_at: Date;
    static check(banner: Banner): void;
}
