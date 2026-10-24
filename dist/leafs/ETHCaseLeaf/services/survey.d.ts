import type { SurveyEvent } from '../../ETHSurveyLeaf/services/options.js';
/**
 * The moment ETHSurveyLeaf asks after: a case closed. Put it in the survey
 * leaf's `events`; each part can be changed.
 *
 *     events: [caseClosedSurveyEvent()]
 */
export declare function caseClosedSurveyEvent(overrides?: Partial<SurveyEvent>): SurveyEvent;
/**
 * With `fromSurvey`, an answer the project judges bad opens a case: once,
 * when the answer comes in. Its failure only prints, the answer is saved.
 */
export declare function watchSurveyAnswers(): void;
