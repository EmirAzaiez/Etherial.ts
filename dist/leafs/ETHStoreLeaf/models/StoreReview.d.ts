import { Model } from 'etherial/components/database/provider';
/**
 * A written review, as the store's own report gives it: App Store Connect's
 * customer reviews, Google Play's monthly reviews file. Read again while it
 * is recent: the author may edit it, the developer reply to it.
 */
export declare class StoreReview extends Model<StoreReview> {
    id: number;
    /** `apple` or `google`. */
    store: string;
    /** The store's own id for it. */
    review_id: string;
    /** 1 to 5. */
    rating: number;
    /** Apple only: Google's reviews have no title. */
    title: string | null;
    body: string | null;
    /** Apple only: the nickname the author chose. */
    author: string | null;
    /** Apple: the storefront, in two letters (`SA`). */
    territory: string | null;
    /** Google: the author's language (`ar`). */
    language: string | null;
    /** Google: the version the author had. */
    version: string | null;
    /** Google: the author's phone. */
    device: string | null;
    written_at: Date;
    /** The developer's answer, as published (Apple also gives one still waiting to be). */
    reply: string | null;
    replied_at: Date | null;
    /** Google: the review in Play Console. */
    url: string | null;
}
