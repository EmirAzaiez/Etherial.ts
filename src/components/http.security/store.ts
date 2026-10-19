import { createHash } from 'crypto'
import { QueryTypes } from 'sequelize'

import etherial from '../../index.js'
import { createTableIfMissing, dialectOf, insertIfAbsent } from '../database/dialect.js'
import { runExclusive } from '../database/lock.js'

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
    attempts: number
    lastAttempt: number
    blockedUntil: number
}

export interface BruteForceRules {
    freeRetries: number
    minWait: number
    maxWait: number
    /** Seconds of quiet after which the count starts over. */
    lifetime: number
}

export interface BruteForceStore {
    /** Counts one attempt for `key`. Returns when it is blocked until (epoch ms), 0 when let through. */
    hit(key: string, rules: BruteForceRules, now: number): Promise<number>
    reset(key: string): Promise<void>
}

/** Entries untouched this long, and not blocked, are dropped. */
const IDLE_MS = 3600 * 1000

/**
 * One attempt against `entry`, which it updates. The same rules for both
 * stores: past `lifetime` of quiet the count starts over; a blocked key is
 * refused without counting; past `freeRetries` each attempt doubles the wait,
 * from `minWait` up to `maxWait`.
 */
export function applyAttempt(entry: BruteForceEntry, rules: BruteForceRules, now: number): number {
    if (now - entry.lastAttempt > rules.lifetime * 1000) {
        entry.attempts = 0
        entry.blockedUntil = 0
    }

    if (entry.blockedUntil > now) {
        return entry.blockedUntil
    }

    entry.lastAttempt = now
    entry.attempts++

    if (entry.attempts > rules.freeRetries) {
        const wait = Math.min(rules.maxWait, rules.minWait * Math.pow(2, entry.attempts - rules.freeRetries - 1))
        entry.blockedUntil = now + wait
    }

    return 0
}

export class MemoryBruteForceStore implements BruteForceStore {
    private entries: Map<string, BruteForceEntry> = new Map()

    constructor() {
        // unref: the sweep alone must not keep a CLI command's process alive.
        setInterval(() => this.cleanup(), 60 * 1000).unref?.()
    }

    async hit(key: string, rules: BruteForceRules, now: number): Promise<number> {
        let entry = this.entries.get(key)
        if (!entry) {
            entry = { attempts: 0, lastAttempt: now, blockedUntil: 0 }
            this.entries.set(key, entry)
        }
        return applyAttempt(entry, rules, now)
    }

    async reset(key: string): Promise<void> {
        this.entries.delete(key)
    }

    private cleanup(): void {
        const now = Date.now()

        for (const [key, entry] of this.entries) {
            // Entry currently blocked: drop only after the block has expired AND it has been idle long enough.
            // Entry never blocked (blockedUntil=0): drop only after the idle threshold — otherwise we'd
            // wipe the in-progress attempt counter on every sweep and the brute-force gate never triggers.
            const idle = now - entry.lastAttempt
            const blockExpired = entry.blockedUntil === 0 || entry.blockedUntil < now

            if (blockExpired && idle > IDLE_MS) {
                this.entries.delete(key)
            }
        }
    }
}

const TABLE = 'etherial_brute_force'
const CLEANUP_MS = 10 * 60 * 1000

/**
 * Postgres and MySQL/MariaDB: the dialects with `SELECT ... FOR UPDATE`, which
 * is what makes ten parallel requests count as ten attempts and not one.
 */
export class DatabaseBruteForceStore implements BruteForceStore {
    private tableReady: Promise<void> | null = null
    private cleanupTimer: NodeJS.Timeout | null = null

    static supports(sequelize: any): boolean {
        if (!sequelize) {
            return false
        }
        return ['postgres', 'mysql', 'mariadb'].includes(dialectOf(sequelize))
    }

    private get db(): any {
        return (etherial as any).database?.sequelize
    }

    private ensureTable(): Promise<void> {
        // The key is hashed: no IP address or e-mail sits in the table, and
        // the primary key has a fixed, short length on every dialect.
        this.tableReady ??= createTableIfMissing(
            this.db,
            `CREATE TABLE IF NOT EXISTS ${TABLE} (key_hash VARCHAR(64) PRIMARY KEY, attempts INTEGER NOT NULL, last_attempt BIGINT NOT NULL, blocked_until BIGINT NOT NULL)`
        )
            .then(() => this.startCleanup())
            .catch((err: unknown) => {
                this.tableReady = null
                throw err
            })
        return this.tableReady!
    }

    async hit(key: string, rules: BruteForceRules, now: number): Promise<number> {
        await this.ensureTable()
        const db = this.db
        const hash = hashKey(key)

        // Outside the transaction: on MySQL, an INSERT IGNORE that finds the row
        // takes a shared lock, and two requests both upgrading it to the
        // exclusive one below deadlock.
        await insertIfAbsent(db, TABLE, 'key_hash', { key_hash: hash, attempts: 0, last_attempt: now, blocked_until: 0 })

        return db.transaction(async (transaction: any) => {
            // The row stays locked until the commit: a parallel request for the
            // same key waits here and reads this one's count.
            const rows: any[] = await db.query(`SELECT attempts, last_attempt, blocked_until FROM ${TABLE} WHERE key_hash = :hash FOR UPDATE`, {
                replacements: { hash },
                type: QueryTypes.SELECT,
                transaction,
            })

            const row = rows[0]
            // Postgres hands BIGINT back as a string.
            const entry: BruteForceEntry = row
                ? { attempts: Number(row.attempts), lastAttempt: Number(row.last_attempt), blockedUntil: Number(row.blocked_until) }
                : { attempts: 0, lastAttempt: now, blockedUntil: 0 }
            const blockedUntil = applyAttempt(entry, rules, now)
            const values = { key_hash: hash, attempts: entry.attempts, last_attempt: entry.lastAttempt, blocked_until: entry.blockedUntil }

            if (!row) {
                // Reset or swept between the insert and the lock: write it again.
                await insertIfAbsent(db, TABLE, 'key_hash', values, { transaction })
                return blockedUntil
            }

            await db.query(`UPDATE ${TABLE} SET attempts = :attempts, last_attempt = :last_attempt, blocked_until = :blocked_until WHERE key_hash = :key_hash`, {
                replacements: values,
                type: QueryTypes.UPDATE,
                transaction,
            })
            return blockedUntil
        })
    }

    async reset(key: string): Promise<void> {
        await this.ensureTable()
        await this.db.query(`DELETE FROM ${TABLE} WHERE key_hash = :hash`, {
            replacements: { hash: hashKey(key) },
            type: QueryTypes.DELETE,
        })
    }

    /**
     * The same rule as the memory store, as one DELETE, by one server per turn.
     * Started once this server has used the table: an app that never protects
     * a route never creates it.
     */
    private startCleanup(): void {
        if (this.cleanupTimer) {
            return
        }

        const cleanup = () => {
            runExclusive('etherial.brute_force_cleanup', { ttlMs: CLEANUP_MS - 60 * 1000, release: false }, async () => {
                const now = Date.now()
                await this.db.query(`DELETE FROM ${TABLE} WHERE blocked_until < :now AND last_attempt < :idle`, {
                    replacements: { now, idle: now - IDLE_MS },
                    type: QueryTypes.DELETE,
                })
            }).catch((err: any) => console.error('[HttpSecurity] Brute-force cleanup:', err?.message || err))
        }

        this.cleanupTimer = setInterval(cleanup, CLEANUP_MS)
        this.cleanupTimer.unref?.()
    }
}

function hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex')
}
