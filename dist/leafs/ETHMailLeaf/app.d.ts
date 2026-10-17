import { Etherial } from 'etherial';
import { RenderedMail } from './services/render.js';
import { ETHMailLeafConfig } from './services/options.js';
import { SendInput, SendResult } from './services/templates.js';
export * from './services/options.js';
export type { RenderedMail } from './services/render.js';
export type { SendInput, SendResult } from './services/templates.js';
export type { EditableTheme } from './services/theme.js';
export type { MailCampaignStatus } from './models/MailCampaign.js';
export type { MailRecipientStatus } from './models/MailCampaignRecipient.js';
/**
 * ETHMailLeaf — the emails a project sends, designed once and edited in the
 * back-office.
 *
 * The project lists its emails in code: a key, the variables the code fills
 * in, and the text in every language, as blocks (heading, text, button, code,
 * note…). The leaf turns them into an email inboxes show well, in the
 * project's colors and logo, right to left in Arabic. The back-office's Emails
 * page rewrites any of them, language by language, with a live preview and a
 * test send; its version goes out instead of the code's until it is reset.
 * Sending goes through ETHPulseLeaf, which keeps the log. Every saved
 * version is kept, and the brand around the emails is edited there too.
 *
 * With `campaigns` in the config, the back-office also writes emails of its
 * own and sends them to the project's audiences, at a date, within the SMTP
 * server's rate, with a working unsubscribe link.
 */
export default class ETHMailLeaf {
    readonly etherial_module_name = "eth_mail_leaf";
    config: ETHMailLeafConfig;
    private routes;
    constructor(config?: ETHMailLeafConfig);
    /** Lifecycle: beforeRun — hand the tables to the database before it syncs. */
    beforeRun({ database }: Etherial): void;
    /** Lifecycle: run — routes. */
    run({ http }: Etherial): void;
    /** Lifecycle: afterRun — the tables are synced: tell the back-office, start sending campaigns. */
    afterRun(): void;
    /**
     * Sends one of the config's emails. The language is `locale`, else the
     * user's (through the config's `locale`), else the default one. Resolves
     * with `sent: false` when the provider refuses it; rejects only for an
     * unknown key or a missing ETHPulseLeaf.
     */
    send(key: string, input: SendInput): Promise<SendResult>;
    /** Whether this address unsubscribed from the campaigns. The emails `send()` sends ignore it: a person needs them. */
    isUnsubscribed(email: string): Promise<boolean>;
    /** The email as it would go out, without sending it. */
    render(key: string, input?: {
        data?: Record<string, unknown>;
        locale?: string | null;
        user?: any;
    }): Promise<RenderedMail>;
    commands(): {
        command: string;
        description: string;
        action: (_etherial: any, key: string, to: string, locale?: string) => Promise<{
            success: boolean;
            message: string;
        }>;
    }[];
}
