/**
 * One language of the form being written, rendered as the bucket would get
 * it. The blocks are read as a draft: one not finished yet (an image not
 * uploaded, a button without its link) shows as it is, and each block says
 * which one of the form it is, for the back-office to point at it.
 * `chrome: false` leaves out the brand and the language switch, for a page
 * shown inside a record (a news' content). `fonts`: those the editor is
 * trying, else the pages' own. `head`: how this page opens, its own choices;
 * `look`: how every page does, as the settings are trying it (null: the
 * theme's). `cover`: its record's photo, a media's id or an address; `logo`:
 * its record's logo, the same way.
 */
export declare function previewPage(body: Record<string, any>): Promise<{
    html: string;
}>;
