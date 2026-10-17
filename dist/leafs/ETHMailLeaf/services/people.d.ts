/**
 * Who saved a version, scheduled a campaign: names for the back-office, read
 * from the project's `User` model with the columns it has. An id it can't
 * name stays out of the map.
 */
export declare function peopleNames(ids: (number | null | undefined)[]): Promise<Map<number, string>>;
/** `{ id, name }`, or null without an id. */
export declare function person(id: number | null | undefined, names: Map<number, string>): {
    id: number;
    name: string;
};
