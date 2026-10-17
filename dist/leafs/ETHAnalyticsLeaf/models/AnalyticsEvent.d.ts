import { Model } from 'etherial/components/database/provider';
/**
 * One thing a user did: a screen they opened, a button they pressed, a call
 * their app made to the API, the app coming to the foreground.
 *
 * `name` is stored raw — the route name, the event key, `GET /users/me/tickets`
 * — and turned into words when it is shown, so a label can change without
 * rewriting history. `user_id` is a plain integer: the leaf does not know the
 * project's user model, and a guest has none.
 */
export declare class AnalyticsEvent extends Model<AnalyticsEvent> {
    id: number;
    session_id: string;
    user_id: number | null;
    /** The app install, so a guest's visits hang together until they sign in. */
    installation_id: string | null;
    /** screen, action, api or app (opened, backgrounded…). */
    type: string;
    name: string;
    /** The screen the user was on when it happened, when the app says so. */
    screen: string | null;
    /** A few details: the ticket opened, the tab picked. Never more than 2 KB. */
    properties: Record<string, unknown> | null;
    /** Time spent on the screen, or how long the API took to answer. */
    duration_ms: number | null;
    /** The HTTP status of an API call. */
    status: number | null;
    platform: string | null;
    app_version: string | null;
    created_at: Date;
}
