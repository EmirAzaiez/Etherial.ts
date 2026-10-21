import type { SurveyForm } from '../models/SurveyForm.js';
import { SurveyKind } from './options.js';
export declare class ReportError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string);
}
export interface Range {
    from: string;
    to: string;
    days: number;
    tz: string;
}
export declare function ensurePostgres(): void;
/** `?from=&to=` as calendar days; the last 90 days when not given (answers come slowly). Two years at most. */
export declare function rangeOf(query: any): Range;
/** The surveys read together: one, or all of the same kind. Those turned off too: their answers stay. */
export declare function surveysOf(query: any): Promise<{
    kind: SurveyKind;
    keys: string[];
    surveys: SurveyForm[];
    one: SurveyForm | null;
}>;
export declare function overview(query: any): Promise<{
    range: Range;
    kind: SurveyKind;
    surveys: string[];
    scale: {
        min: number;
        max: number;
    };
    current: any;
    previous: any;
    distribution: {
        score: number;
        count: any;
    }[];
    trend: {
        week: any;
        answered: any;
        score: number;
    }[];
    subjects: {
        label: any;
        answered: any;
        score: number;
        average: any;
    }[];
    questions: any[];
}>;
/**
 * Each survey's numbers over the period, for the list of surveys: how many
 * were asked and answered, its score, and the questions open right now.
 */
export declare function bySurvey(query: any): Promise<{
    range: Range;
    surveys: Record<string, unknown>;
}>;
/**
 * What people wrote, the latest answers first; `group` keeps the high, middle
 * or low scores, `all=1` the answers without a comment too. `limit` up to 50.
 */
export declare function comments(query: any): Promise<{
    kind: SurveyKind;
    items: any[];
    nextBefore: string;
}>;
/** Everything one person was asked, for their page in the back-office. */
export declare function userResponses(userId: number): Promise<any[]>;
