import { SurveyEvent } from './options.js';
export interface InviteInput {
    /** The survey's key (`survey_forms.key`). */
    survey: string;
    user_id: number;
    /** What prompted it. Asking twice about the same thing is a no-op. */
    subject?: {
        type?: string;
        id?: string | number;
        label?: string | null;
    };
    /** When it happened. Default now. */
    at?: Date;
}
export type InviteResult = {
    invited: true;
    id: number;
} | {
    invited: false;
    reason: 'unknown_survey' | 'inactive' | 'excluded' | 'cooldown' | 'already_asked' | 'no_user';
};
/**
 * Puts a survey to someone. It opens after the survey's delay and closes when
 * it expires. Nobody is asked twice about the same thing, nor more than once
 * per cooldown, whatever the survey.
 */
export declare function invite(input: InviteInput): Promise<InviteResult>;
/**
 * Tells people their question is open, once each. A row is claimed before
 * `notify` runs, so two servers never send the same push.
 */
export declare function notifyDue(): Promise<void>;
/** Questions left open past their date are closed, so the lists and the response rate stay right. */
export declare function expireDue(): Promise<number>;
/** Hooks each event on its model. Unknown models are reported, not fatal. */
export declare function attachEvents(events: SurveyEvent[]): void;
