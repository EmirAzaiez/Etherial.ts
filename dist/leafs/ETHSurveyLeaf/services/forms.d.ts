import { SurveyForm } from '../models/SurveyForm.js';
import { SurveyEvent, SurveyInfo, SurveyQuestion, SurveyTargetOption } from './options.js';
export declare function eventOf(key: unknown): SurveyEvent | undefined;
export declare function surveyByKey(key: string): Promise<SurveyForm | null>;
export declare function allSurveys(): Promise<SurveyForm[]>;
export declare function activeKeys(): Promise<string[]>;
export declare function infoOf(form: SurveyForm): SurveyInfo;
/** What the back-office reads of a survey: the Surveys page, its tabs, its forms. */
export declare function adminInfoOf(form: SurveyForm): {
    id: number;
    key: string;
    title: string;
    description: string;
    active: boolean;
    kind: import("./options.js").SurveyKind;
    question: string;
    event: string;
    eventLabel: string;
    targetLabel: string;
    targets: SurveyTargetOption[];
    questions: SurveyQuestion[];
    delayMinutes: number;
    expiresAfterDays: number;
};
/**
 * The survey asked after this event, for this value of it (a scheduler, a
 * ticket type): the one narrowed to it, else the one asked after every one.
 * Saving checks that no two active surveys of an event overlap.
 */
export declare function surveyFor(event: string, target: string | null): Promise<SurveyForm | null>;
/** Its message is shown in the back-office's form, as the admin leaf does with a hook's errors. */
export declare class SurveyFormError extends Error {
}
export declare function normalizeQuestions(value: unknown): SurveyQuestion[];
export declare function prepareCreate(data: Record<string, any>): Promise<{
    key: string;
    title: any;
    description: any;
    event: string;
    targets: SurveyTargetOption[];
    questions: SurveyQuestion[];
    active: boolean;
    delay_minutes: number;
    expires_after_days: number;
}>;
export declare function prepareUpdate(record: SurveyForm, data: Record<string, any>): Promise<{
    title: any;
    description: any;
    event: string;
    targets: SurveyTargetOption[];
    questions: SurveyQuestion[];
    active: boolean;
    delay_minutes: number;
    expires_after_days: number;
}>;
export declare function checkDelete(record: SurveyForm): Promise<void>;
/** The questions as the person reads them, in their language. */
export declare function questionsFor(form: SurveyForm, locale: string): {
    options?: {
        id: string;
        label: string;
    }[];
    scale?: {
        min: number;
        max: number;
    };
    low_label?: string;
    high_label?: string;
    id: string;
    type: import("./options.js").QuestionType;
    label: string;
    required: boolean;
}[];
export type ReadAnswers = {
    ok: true;
    answers: Record<string, unknown>;
    score: number;
    comment: string | null;
} | {
    ok: false;
    error: string;
};
/**
 * `{ answers: { q1: 9, q2: 'o1', q3: ['o1', 'o3'], q4: 'text' } }`. The app
 * before several questions sends `{ score, comment }`: the score answers the
 * first question, the comment the first written one, and the questions it
 * never showed are not asked of it.
 */
export declare function readAnswers(form: SurveyForm, body: any): ReadAnswers;
