import { Etherial } from 'etherial';
import { InviteInput, InviteResult } from './services/invitations.js';
import { ETHSurveyLeafConfig } from './services/options.js';
export * from './services/options.js';
export type { InviteInput, InviteResult } from './services/invitations.js';
/**
 * ETHSurveyLeaf — satisfaction surveys in the app, scored in the back-office.
 *
 * The surveys are written in the back-office: a rating that scores them (NPS
 * 0–10, or satisfaction 1–5), then up to nine more questions — ratings,
 * choices, written answers — and the event they are asked after. The project
 * declares those events (an appointment done, a ticket closed) and what a
 * survey can be narrowed to (a scheduler, a ticket type). The app asks for the
 * survey waiting (`GET /surveys/pending`), shows it, and posts the answers.
 * The back-office's Surveys page reads the score, the response rate, the
 * trend and what people answered. Postgres only.
 */
export default class ETHSurveyLeaf {
    readonly etherial_module_name = "eth_survey_leaf";
    config: ETHSurveyLeafConfig;
    private routes;
    constructor(config?: ETHSurveyLeafConfig);
    /**
     * Lifecycle: beforeRun — hand the tables to the database before it syncs,
     * and the surveys' form to the back-office before it sets up its history.
     */
    beforeRun({ database }: Etherial): void;
    /** Lifecycle: run — routes, and the clock that opens and closes questions. */
    run({ http }: Etherial): void;
    /** Lifecycle: afterRun — every model exists: hook the events, tell the back-office. */
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
