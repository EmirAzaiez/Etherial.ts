import { Model } from 'etherial/components/database/provider';
/** An office or a sales center: where it is, when it opens, how to call it. */
export declare class Office extends Model<Office> {
    id: number;
    /** `{ en: 'Dubai Sales Center' }` */
    name: Record<string, string>;
    /** The name in the default language: the back-office's lists and search. Written by the leaf. */
    label: string;
    /** `{ en: 'Building 3, …' }`, on several lines if need be. */
    address: Record<string, string>;
    phone: string | null;
    email: string | null;
    /** `{ en: 'Sun–Thu, 9:00–17:00' }`, in words. */
    hours: Record<string, string>;
    latitude: number | null;
    longitude: number | null;
    /** A Google Maps link. Empty: the app's is made from the pin. */
    map_url: string | null;
    position: number;
    published: boolean;
    created_at: Date;
    updated_at: Date;
    static fillLabel(office: Office): void;
}
