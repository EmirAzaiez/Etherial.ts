export interface FilterRow {
    field: string;
    operator: FilterOperator;
    value?: any;
}
export type FilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'in' | 'not_in' | 'is_empty' | 'is_not_empty' | 'is_true' | 'is_false';
export declare const OPERATOR_OPTIONS: {
    value: string;
    label: string;
}[];
/** Operators that ignore whatever is in the value box. */
export declare const UNARY_OPERATORS: FilterOperator[];
/** The columns a collection can be filtered on, for the condition widget. */
export declare function filterableFields(collectionName: string): {
    value: string;
    label: string;
}[];
export declare function toWhere(rows: FilterRow[] | undefined, match?: 'all' | 'any'): Record<string, any>;
/**
 * Equality that forgives the trip through JSON and HTML forms.
 *
 * A select stores `"1"`, the column holds `1`, and a customer comparing the two
 * is right to expect them to match. Dates are compared as instants, not as the
 * strings they happen to have been serialized to.
 */
export declare function looseEqual(left: any, right: any): boolean;
export declare function isEmpty(value: any): boolean;
export declare function isTruthy(value: any): boolean;
export declare function evaluate(rows: FilterRow[] | undefined, read: (field: string) => any, match?: 'all' | 'any'): boolean;
/**
 * A condition step compares two *expressions*, not a column and a value:
 * `{{record.total}}` against `{{steps.quote.amount}}` is a perfectly ordinary
 * thing to want, and neither side is a field name.
 */
export interface ExpressionRow {
    left?: any;
    operator: FilterOperator;
    right?: any;
}
export declare function evaluateExpressions(rows: ExpressionRow[] | undefined, match?: 'all' | 'any'): boolean;
