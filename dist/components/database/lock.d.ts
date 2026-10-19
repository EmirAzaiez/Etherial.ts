/**
 * A lease in the database, so a periodic job runs on one server only.
 *
 * Every timer of the leafs (flow ticker, audit purge, campaign sweeps…) runs in
 * each process: with two instances of an API, a cron flow fired twice and a
 * push campaign went out twice. The first server to take the lease runs the
 * job; the others skip that turn.
 *
 * The lease lives in `etherial_locks`, created on first use. A server that
 * dies holding it does not block anyone for long: the lease expires.
 *
 * Expiry is epoch milliseconds in a BIGINT, not a TIMESTAMP: the same on
 * Postgres, MySQL and SQLite, with no session time zone or MySQL TIMESTAMP
 * rounding between what one server writes and what another compares. The
 * servers' clocks must agree to within the margin the callers leave (seconds;
 * NTP keeps them to milliseconds).
 */
export interface ExclusiveOptions {
    /** How long the lease is good for. Past it, another server may take it. */
    ttlMs: number;
    /**
     * Give the lease back when the job is done (default). A periodic job keeps
     * it instead, `release: false` with a ttl just under its period: a server
     * whose timer fires a moment later must not run the same turn again.
     */
    release?: boolean;
}
/**
 * Runs `fn` if this server takes the lease `name`, and returns its result;
 * returns `undefined` without running it when another server holds it.
 *
 * Without a database (a CLI with no DB, a test) the job simply runs.
 */
export declare function runExclusive<T>(name: string, options: ExclusiveOptions, fn: () => Promise<T>): Promise<T | undefined>;
