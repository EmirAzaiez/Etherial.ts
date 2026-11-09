/** `active`: a language other than English is in use (words only it needs, like a create button's, are sent then). */
export type LeafText = ((text: string, context?: string) => string) & {
    active?: boolean;
};
/**
 * The translator for `locale` (`fr`, `fr-FR`): `t('Change history')`. A word
 * that needs two translations takes a context, looked up as `text_context`
 * first (`t('Created', 'action')`).
 */
export declare function leafText(locale?: string | null): LeafText;
/** The field names a display template reads: `{firstname} {lastname|email}` → firstname, lastname, email. */
export declare function templateFields(template: string | undefined): string[];
/** The template's fields that are columns of the Sequelize model `modelName` (all of them when it isn't found). */
export declare function modelTemplateFields(template: string | undefined, modelName: string): string[];
/**
 * A display template filled from a record, as the back-office fills it:
 * `{a|b}` is the first of them that isn't empty. Null when nothing came out.
 */
export declare function fillTemplate(template: string, get: (name: string) => unknown): string | null;
