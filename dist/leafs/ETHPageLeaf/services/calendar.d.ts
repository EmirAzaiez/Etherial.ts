/** An event as a calendar gets it: `date` / `until`: `YYYY-MM-DD`; `start` / `end`: `HH:MM`, in the project's timezone. */
export interface CalendarEvent {
    title: string;
    date: string;
    until?: string;
    start?: string;
    end?: string;
    place?: string;
}
export type CalendarTarget = 'google' | 'outlook' | 'file';
/** The event a link carries, checked: null when it is not one. */
export declare function eventOf(query: Record<string, unknown>): CalendarEvent | null;
/** The link the page shows: through the API when its address is known, else Google Calendar's. */
export declare function calendarLinks(event: CalendarEvent, timezone?: string): {
    url: string;
    choices: Record<CalendarTarget, string> | null;
};
/** What a phone or a computer gets when nothing is asked: Android, Google Calendar; the others, the file. */
export declare function targetOf(asked: unknown, userAgent: string): CalendarTarget;
/** Google Calendar's "new event" page, filled in. */
export declare function googleUrl(event: CalendarEvent, timezone?: string): string;
/** Outlook's "new event" page (outlook.com), filled in. */
export declare function outlookUrl(event: CalendarEvent, timezone?: string): string;
/** The event as a calendar file: its times in UTC when the zone is known, else as the phone's clock reads them. */
export declare function icsOf(event: CalendarEvent, timezone?: string): string;
/** The file's name: its title in plain letters. */
export declare function fileNameOf(event: CalendarEvent): string;
