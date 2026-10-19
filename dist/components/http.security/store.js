var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createHash } from 'crypto';
import { QueryTypes } from 'sequelize';
import etherial from '../../index.js';
import { createTableIfMissing, dialectOf, insertIfAbsent } from '../database/dialect.js';
import { runExclusive } from '../database/lock.js';
/** Entries untouched this long, and not blocked, are dropped. */
const IDLE_MS = 3600 * 1000;
/**
 * One attempt against `entry`, which it updates. The same rules for both
 * stores: past `lifetime` of quiet the count starts over; a blocked key is
 * refused without counting; past `freeRetries` each attempt doubles the wait,
 * from `minWait` up to `maxWait`.
 */
export function applyAttempt(entry, rules, now) {
    if (now - entry.lastAttempt > rules.lifetime * 1000) {
        entry.attempts = 0;
        entry.blockedUntil = 0;
    }
    if (entry.blockedUntil > now) {
        return entry.blockedUntil;
    }
    entry.lastAttempt = now;
    entry.attempts++;
    if (entry.attempts > rules.freeRetries) {
        const wait = Math.min(rules.maxWait, rules.minWait * Math.pow(2, entry.attempts - rules.freeRetries - 1));
        entry.blockedUntil = now + wait;
    }
    return 0;
}
export class MemoryBruteForceStore {
    constructor() {
        var _a, _b;
        this.entries = new Map();
        // unref: the sweep alone must not keep a CLI command's process alive.
        (_b = (_a = setInterval(() => this.cleanup(), 60 * 1000)).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
    hit(key, rules, now) {
        return __awaiter(this, void 0, void 0, function* () {
            let entry = this.entries.get(key);
            if (!entry) {
                entry = { attempts: 0, lastAttempt: now, blockedUntil: 0 };
                this.entries.set(key, entry);
            }
            return applyAttempt(entry, rules, now);
        });
    }
    reset(key) {
        return __awaiter(this, void 0, void 0, function* () {
            this.entries.delete(key);
        });
    }
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.entries) {
            // Entry currently blocked: drop only after the block has expired AND it has been idle long enough.
            // Entry never blocked (blockedUntil=0): drop only after the idle threshold — otherwise we'd
            // wipe the in-progress attempt counter on every sweep and the brute-force gate never triggers.
            const idle = now - entry.lastAttempt;
            const blockExpired = entry.blockedUntil === 0 || entry.blockedUntil < now;
            if (blockExpired && idle > IDLE_MS) {
                this.entries.delete(key);
            }
        }
    }
}
const TABLE = 'etherial_brute_force';
const CLEANUP_MS = 10 * 60 * 1000;
/**
 * Postgres and MySQL/MariaDB: the dialects with `SELECT ... FOR UPDATE`, which
 * is what makes ten parallel requests count as ten attempts and not one.
 */
export class DatabaseBruteForceStore {
    constructor() {
        this.tableReady = null;
        this.cleanupTimer = null;
    }
    static supports(sequelize) {
        if (!sequelize) {
            return false;
        }
        return ['postgres', 'mysql', 'mariadb'].includes(dialectOf(sequelize));
    }
    get db() {
        var _a;
        return (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize;
    }
    ensureTable() {
        var _a;
        // The key is hashed: no IP address or e-mail sits in the table, and
        // the primary key has a fixed, short length on every dialect.
        (_a = this.tableReady) !== null && _a !== void 0 ? _a : (this.tableReady = createTableIfMissing(this.db, `CREATE TABLE IF NOT EXISTS ${TABLE} (key_hash VARCHAR(64) PRIMARY KEY, attempts INTEGER NOT NULL, last_attempt BIGINT NOT NULL, blocked_until BIGINT NOT NULL)`)
            .then(() => this.startCleanup())
            .catch((err) => {
            this.tableReady = null;
            throw err;
        }));
        return this.tableReady;
    }
    hit(key, rules, now) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            const db = this.db;
            const hash = hashKey(key);
            // Outside the transaction: on MySQL, an INSERT IGNORE that finds the row
            // takes a shared lock, and two requests both upgrading it to the
            // exclusive one below deadlock.
            yield insertIfAbsent(db, TABLE, 'key_hash', { key_hash: hash, attempts: 0, last_attempt: now, blocked_until: 0 });
            return db.transaction((transaction) => __awaiter(this, void 0, void 0, function* () {
                // The row stays locked until the commit: a parallel request for the
                // same key waits here and reads this one's count.
                const rows = yield db.query(`SELECT attempts, last_attempt, blocked_until FROM ${TABLE} WHERE key_hash = :hash FOR UPDATE`, {
                    replacements: { hash },
                    type: QueryTypes.SELECT,
                    transaction,
                });
                const row = rows[0];
                // Postgres hands BIGINT back as a string.
                const entry = row
                    ? { attempts: Number(row.attempts), lastAttempt: Number(row.last_attempt), blockedUntil: Number(row.blocked_until) }
                    : { attempts: 0, lastAttempt: now, blockedUntil: 0 };
                const blockedUntil = applyAttempt(entry, rules, now);
                const values = { key_hash: hash, attempts: entry.attempts, last_attempt: entry.lastAttempt, blocked_until: entry.blockedUntil };
                if (!row) {
                    // Reset or swept between the insert and the lock: write it again.
                    yield insertIfAbsent(db, TABLE, 'key_hash', values, { transaction });
                    return blockedUntil;
                }
                yield db.query(`UPDATE ${TABLE} SET attempts = :attempts, last_attempt = :last_attempt, blocked_until = :blocked_until WHERE key_hash = :key_hash`, {
                    replacements: values,
                    type: QueryTypes.UPDATE,
                    transaction,
                });
                return blockedUntil;
            }));
        });
    }
    reset(key) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            yield this.db.query(`DELETE FROM ${TABLE} WHERE key_hash = :hash`, {
                replacements: { hash: hashKey(key) },
                type: QueryTypes.DELETE,
            });
        });
    }
    /**
     * The same rule as the memory store, as one DELETE, by one server per turn.
     * Started once this server has used the table: an app that never protects
     * a route never creates it.
     */
    startCleanup() {
        var _a, _b;
        if (this.cleanupTimer) {
            return;
        }
        const cleanup = () => {
            runExclusive('etherial.brute_force_cleanup', { ttlMs: CLEANUP_MS - 60 * 1000, release: false }, () => __awaiter(this, void 0, void 0, function* () {
                const now = Date.now();
                yield this.db.query(`DELETE FROM ${TABLE} WHERE blocked_until < :now AND last_attempt < :idle`, {
                    replacements: { now, idle: now - IDLE_MS },
                    type: QueryTypes.DELETE,
                });
            })).catch((err) => console.error('[HttpSecurity] Brute-force cleanup:', (err === null || err === void 0 ? void 0 : err.message) || err));
        };
        this.cleanupTimer = setInterval(cleanup, CLEANUP_MS);
        (_b = (_a = this.cleanupTimer).unref) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
}
function hashKey(key) {
    return createHash('sha256').update(key).digest('hex');
}
