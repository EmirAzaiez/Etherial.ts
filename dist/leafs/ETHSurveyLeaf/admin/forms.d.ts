import { ETHSurveyLeafConfig } from '../services/options.js';
/** The back-office widget on the event: the choice, then what it is narrowed to. */
export declare const SURVEY_TRIGGER_WIDGET = "survey-trigger";
/** Served as written (a `json` field would be flattened for display): the BO draws them. */
export declare const SURVEY_QUESTIONS_TYPE = "survey-questions";
export declare const SURVEY_TARGETS_TYPE = "survey-targets";
/** Hooks first: the admin leaf reads a collection's hooks when it is registered. */
export declare function registerSurveyFormsAdmin(adminLeaf: any, config: ETHSurveyLeafConfig): void;
