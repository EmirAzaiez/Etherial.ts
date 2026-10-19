import etherial from '../../index.js'
import { randomUUID } from 'crypto'
import { QueryTypes } from 'sequelize'

import { createTableIfMissing, insertIfAbsent } from './dialect.js'

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
    ttlMs: number
    /**
     * Give the lease back when the job is done (default). A periodic job keeps
     * it instead, `release: false` with a ttl just under its period: a server
     * whose timer fires a moment later must not run the same turn again.
     */
    release?: boolean
}

const OWNER = `${process.pid}-${randomUUID()}`
let tableReady: Promise<void> | null = null

const sequelize = () => (etherial as any).database?.sequelize

function ensureTable(): Promise<void> {
    // VARCHAR(191): the longest key MySQL indexes in utf8mb4 on older InnoDB.
    tableReady ??= createTableIfMissing(
        sequelize(),
        'CREATE TABLE IF NOT EXISTS etherial_locks (name VARCHAR(191) PRIMARY KEY, owner VARCHAR(64) NOT NULL, expires_at BIGINT NOT NULL)'
    ).catch((err: unknown) => {
        tableReady = null
        throw err
    })
    return tableReady!
}

async function acquire(name: string, ttlMs: number): Promise<boolean> {
    const db = sequelize()
    const now = Date.now()
    const expires = now + ttlMs

    // An expired lease: take it over. Only one UPDATE matches the old expiry.
    const [, updated] = await db.query('UPDATE etherial_locks SET owner = :owner, expires_at = :expires WHERE name = :name AND expires_at < :now', {
        replacements: { owner: OWNER, expires, name, now },
        type: QueryTypes.UPDATE,
    })
    if (Number(updated) > 0) {
        return true
    }

    // No lease yet: the primary key lets one INSERT through. A held lease
    // lands here too and inserts nothing. A real error (connection lost) is
    // thrown: swallowed, the job would silently never run again.
    return insertIfAbsent(db, 'etherial_locks', 'name', { name, owner: OWNER, expires_at: expires })
}

async function release(name: string): Promise<void> {
    await sequelize().query('DELETE FROM etherial_locks WHERE name = :name AND owner = :owner', {
        replacements: { name, owner: OWNER },
        type: QueryTypes.DELETE,
    })
}

/**
 * Runs `fn` if this server takes the lease `name`, and returns its result;
 * returns `undefined` without running it when another server holds it.
 *
 * Without a database (a CLI with no DB, a test) the job simply runs.
 */
export async function runExclusive<T>(name: string, options: ExclusiveOptions, fn: () => Promise<T>): Promise<T | undefined> {
    if (!sequelize()) {
        return fn()
    }

    await ensureTable()
    if (!(await acquire(name, options.ttlMs))) {
        return undefined
    }

    try {
        return await fn()
    } finally {
        if (options.release !== false) {
            await release(name).catch(() => undefined)
        }
    }
}
