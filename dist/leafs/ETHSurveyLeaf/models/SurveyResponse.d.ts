import { Model } from 'etherial/components/database/provider';
/**
 * One question put to one person: asked, then answered, dismissed or left to
 * expire. The row exists from the moment the person is invited, so the
 * back-office can tell how many of those asked answered.
 */
export declare class SurveyResponse extends Model<SurveyResponse> {
    id: number;
    /** The survey's key (`survey_forms.key`). */
    survey: string;
    user_id: number;
    /** What prompted the question: the model and row a trigger saw. */
    subject_type: string;
    subject_id: string;
    subject_label: string | null;
    /** pending, answered, dismissed, expired. */
    status: string;
    /** The answer to the first question, the rating that scores the survey. */
    score: number | null;
    /** The first written answer, read on the Surveys page with the score. */
    comment: string | null;
    /** Every answer, by question id: a number, an option id, a list of them, a text. */
    answers: Record<string, unknown> | null;
    /** The language the question was read in. */
    locale: string | null;
    platform: string | null;
    app_version: string | null;
    /** The question opens then: what happened plus the survey's delay. */
    available_at: Date;
    expires_at: Date;
    notified_at: Date | null;
    answered_at: Date | null;
    created_at: Date;
    updated_at: Date;
}
