import type { Transaction } from 'sequelize';
import { Model } from 'etherial/components/database/provider';
/**
 * A language the contents are written in (Content › Languages): its fields
 * in every form of the back-office, and in the app once `published`. One is
 * the default: what a text missing in another language falls back to, so
 * every content needs it. A language removed leaves its texts in place.
 */
export declare class ContentLanguage extends Model<ContentLanguage> {
    id: number;
    /** `fr`: the key of its texts in every content. It can't change. */
    code: string;
    /** `Français`, as the app's language picker shows it. Empty: its own name. */
    name: string;
    /** Written right to left. Empty: as `rtlLocales` says (Arabic, Hebrew, Persian, Urdu). */
    rtl: boolean | null;
    is_default: boolean;
    /** In the app. Off: in the back-office only, while it is being translated. The default always is. */
    published: boolean;
    created_at: Date;
    updated_at: Date;
    /** The previous default, when this one takes its place: for `switched`. */
    becomesDefault?: boolean;
    /** The languages to the running leaf, the default first. */
    static load(): Promise<void>;
    /** Sequelize checks NOT NULL before `check` runs: a name left empty waits for it as ''. */
    static emptyName(language: ContentLanguage): void;
    static check(language: ContentLanguage, options: {
        transaction?: Transaction | null;
    }): Promise<void>;
    /** The previous default no longer is; the back-office's titles follow the new one. Then the languages are read again. */
    static switched(language: ContentLanguage, options: {
        transaction?: Transaction | null;
    }): Promise<void>;
    static keepDefault(language: ContentLanguage): void;
    static removed(_language: ContentLanguage, options: {
        transaction?: Transaction | null;
    }): Promise<void>;
}
