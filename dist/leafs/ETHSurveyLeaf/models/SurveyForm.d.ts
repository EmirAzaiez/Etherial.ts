import { Model } from 'etherial/components/database/provider';
import type { SurveyQuestion, SurveyTargetOption } from '../services/options.js';
/**
 * A survey, written in the back-office: its questions, and when it is asked —
 * after which event of the project, narrowed or not to some of its values (the
 * bookings of a scheduler, the tickets of a type).
 */
export declare class SurveyForm extends Model<SurveyForm> {
    id: number;
    /** Stored with every answer (`survey_responses.survey`): set once, from the title. */
    key: string;
    title: string;
    description: string | null;
    /** Off: nobody is asked any more, and the questions still waiting are no longer shown. */
    active: boolean;
    /** The project's event it is asked after (`config.events[].key`). */
    event: string | null;
    /** The event's values it is narrowed to, with their label when chosen. Empty: every one. */
    targets: SurveyTargetOption[];
    questions: SurveyQuestion[];
    /** Minutes between the event and the question: let the visit end first. */
    delay_minutes: number;
    /** Days the question stays open before it is dropped. */
    expires_after_days: number;
    created_at: Date;
    updated_at: Date;
}
