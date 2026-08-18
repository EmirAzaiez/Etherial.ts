import type { CollectionConfig } from '../../ETHAdminLeaf/features/CollectionConfig.js';
import type { FieldDefinition } from '../../ETHAdminLeaf/features/ActionRegistry.js';
import type { OutputField } from '../types.js';
/** The admin leaf, or null when the project runs without one. */
export declare function adminLeaf(): any | null;
export declare function listCollections(): CollectionConfig[];
export declare function getCollection(name: string): CollectionConfig | null;
/** The Sequelize model behind a collection. */
export declare function getModel(name: string): any | null;
export declare function collectionLabel(collection: CollectionConfig): string;
export declare function collectionLabelPlural(collection: CollectionConfig): string;
export declare function humanize(value: string): string;
/**
 * Fields a collection's records expose to templates.
 *
 * Relations are walked one level: `{{record.customer.email}}` is the single
 * most useful thing an automation ever asks for — you notify the person
 * attached to the thing that happened, not the thing itself — and stopping at
 * one level keeps the picker finite on a schema where everything eventually
 * points at everything.
 *
 * `hasMany` and `belongsToMany` are left out: they are not on the instance, and
 * a step that needs the children has `data.find` for it.
 */
export declare function collectionOutputFields(name: string, depth?: number): OutputField[];
/** `customer_id` → `customer`; anything else is left alone. */
export declare function relationKey(fieldName: string): string;
/**
 * The dates of a collection, as options for a picker.
 *
 * Two sources, and the second one matters: a project is free to give a date
 * column a form widget of its own — DARWAEMAR fills `appointments.starts_at`
 * with a slot picker rather than a calendar — and reading the admin `type`
 * alone would hide the single most useful date in the schema behind the fact
 * that it is entered in an unusual way. The column's own Sequelize type is the
 * honest answer, so the declared fields are completed with it.
 */
export declare function dateFieldOptions(name: string): {
    value: string;
    label: string;
}[];
/** The same, as the field definitions themselves — declared ones only. */
export declare function dateFields(name: string): FieldDefinition[];
/**
 * Turns a model instance into the plain object templates read.
 *
 * Two things happen here that matter downstream: Dates and Decimals become
 * values JSON can hold (a run row is JSON, and a run that cannot be written is
 * a run that cannot be read back), and each relation is loaded once and exposed
 * under its bare name.
 */
export declare function hydrateRecord(collectionName: string | undefined, instance: any): Promise<Record<string, any>>;
