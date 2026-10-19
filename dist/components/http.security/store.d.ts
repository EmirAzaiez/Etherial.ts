/**
 * Where the brute-force counters live.
 *
 * In memory, each server counted on its own: behind a load balancer with N
 * servers an attacker had N times the free retries, and every deploy gave them
 * all back. With a database the counters are in `etherial_brute_force`, shared
 * by every server and kept across restarts. The memory store stays for an app
 * without a database, a dialect that cannot lock a row (SQLite), and as the
 * fallback when the database fails a query: a login must not break because the
 * counter could not be written.
 */
export interface BruteForceEntry {
    attempts: number;
    lastAttempt: number;
    blockedUntil: number;
}
export interface BruteForceRules {
    freeRetries: number;
    minWait: number;
    maxWait: number;
    /** Seconds of quiet after which the count starts over. */
    lifetime: number;
}
export interface BruteForceStore {
    /** Counts one attempt for `key`. Returns when it is blocked until (epoch ms), 0 when let through. */
    hit(key: string, rules: BruteForceRules, now: number): Promise<number>;
    reset(key: string): Promise<void>;
}
/**
 * One attempt against `entry`, which it updates. The same rules for both
 * stores: past `lifetime` of quiet the count starts over; a blocked key is
 * refused without counting; past `freeRetries` each attempt doubles the wait,
 * from `minWait` up to `maxWait`.
 */
export declare function applyAttempt(entry: BruteForceEntry, rules: BruteForceRules, now: number): number;
export declare class MemoryBruteForceStore implements BruteForceStore {
    private entries;
    constructor();
    hit(key: string, rules: BruteForceRules, now: number): Promise<number>;
    reset(key: string): Promise<void>;
    private cleanup;
}
/**
 * Postgres and MySQL/MariaDB: the dialects with `SELECT ... FOR UPDATE`, which
 * is what makes ten parallel requests count as ten attempts and not one.
 */
export declare class DatabaseBruteForceStore implements BruteForceStore {
    private tableReady;
    private cleanupTimer;
    static supports(sequelize: any): boolean;
    private get db();
    private ensureTable;
    hit(key: string, rules: BruteForceRules, now: number): Promise<number>;
    reset(key: string): Promise<void>;
    /**
     * The same rule as the memory store, as one DELETE, by one server per turn.
     * Started once this server has used the table: an app that never protects
     * a route never creates it.
     */
    private startCleanup;
}
