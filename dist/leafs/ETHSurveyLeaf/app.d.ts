import { Etherial } from 'etherial';
import { InviteInput, InviteResult } from './services/invitations.js';
import { ETHSurveyLeafConfig } from './services/options.js';
export * from './services/options.js';
export type { InviteInput, InviteResult } from './services/invitations.js';
/**
 * ETHSurveyLeaf — satisfaction surveys in the app, scored in the back-office.
 *
 * A survey is one question (NPS 0–10, or satisfaction 1–5) and an optional
 * comment. People are invited by a trigger — an appointment marked as done, a
 * ticket closed — or by the project's code. The app asks for the question
 * waiting (`GET /surveys/pending`), shows it, and posts the answer. The
 * back-office's Surveys page reads the score, the response rate, the trend
 * and what people wrote. Postgres only.
 */
export default class ETHSurveyLeaf {
    readonly etherial_module_name = "eth_survey_leaf";
    config: ETHSurveyLeafConfig;
    private routes;
    constructor(config?: ETHSurveyLeafConfig);
    /** Lifecycle: beforeRun — hand the table to the database before it syncs. */
    beforeRun({ database }: Etherial): void;
    /** Lifecycle: run — routes, and the clock that opens and closes questions. */
    run({ http }: Etherial): void;
    /** Lifecycle: afterRun — every model exists: hook the triggers, tell the back-office. */
    afterRun(): void;
    /** Asks someone a survey from the project's own code. */
    invite(input: InviteInput): Promise<InviteResult>;
    commands(): {
        command: string;
        description: string;
        action: () => Promise<{
            success: boolean;
            message: string;
        }>;
    }[];
}
