import { Model } from 'etherial/components/database/provider';
import { ContactKind } from '../services/options.js';
/** One way to reach the company: a phone number, a WhatsApp, an email address, a site, a social account. */
export declare class Contact extends Model<Contact> {
    id: number;
    /** `phone`, `whatsapp`, `email`, `website`, `instagram`… (CONTACT_KINDS). The app picks its icon from it. */
    kind: ContactKind;
    /** `+971 4 123 4567`, `care@example.com`, `https://instagram.com/…`. The app's link is made from it. */
    value: string;
    /** `{ en: 'Customer care' }`. Empty: the app names it after its kind. */
    label: Record<string, string>;
    /** `{ en: 'Sun–Thu, 9:00–17:00' }`, in words. */
    hours: Record<string, string>;
    position: number;
    published: boolean;
    created_at: Date;
    updated_at: Date;
    static check(contact: Contact): void;
}
