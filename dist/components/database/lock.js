var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import etherial from '../../index.js';
import { randomUUID } from 'crypto';
import { QueryTypes } from 'sequelize';
import { createTableIfMissing, insertIfAbsent } from './dialect.js';
const OWNER = `${process.pid}-${randomUUID()}`;
let tableReady = null;
const sequelize = () => { var _a; return (_a = etherial.database) === null || _a === void 0 ? void 0 : _a.sequelize; };
function ensureTable() {
    // VARCHAR(191): the longest key MySQL indexes in utf8mb4 on older InnoDB.
    tableReady !== null && tableReady !== void 0 ? tableReady : (tableReady = createTableIfMissing(sequelize(), 'CREATE TABLE IF NOT EXISTS etherial_locks (name VARCHAR(191) PRIMARY KEY, owner VARCHAR(64) NOT NULL, expires_at BIGINT NOT NULL)').catch((err) => {
        tableReady = null;
        throw err;
    }));
    return tableReady;
}
function acquire(name, ttlMs) {
    return __awaiter(this, void 0, void 0, function* () {
        const db = sequelize();
        const now = Date.now();
        const expires = now + ttlMs;
        // An expired lease: take it over. Only one UPDATE matches the old expiry.
        const [, updated] = yield db.query('UPDATE etherial_locks SET owner = :owner, expires_at = :expires WHERE name = :name AND expires_at < :now', {
            replacements: { owner: OWNER, expires, name, now },
            type: QueryTypes.UPDATE,
        });
        if (Number(updated) > 0) {
            return true;
        }
        // No lease yet: the primary key lets one INSERT through. A held lease
        // lands here too and inserts nothing. A real error (connection lost) is
        // thrown: swallowed, the job would silently never run again.
        return insertIfAbsent(db, 'etherial_locks', 'name', { name, owner: OWNER, expires_at: expires });
    });
}
function release(name) {
    return __awaiter(this, void 0, void 0, function* () {
        yield sequelize().query('DELETE FROM etherial_locks WHERE name = :name AND owner = :owner', {
            replacements: { name, owner: OWNER },
            type: QueryTypes.DELETE,
        });
    });
}
/**
 * Runs `fn` if this server takes the lease `name`, and returns its result;
 * returns `undefined` without running it when another server holds it.
 *
 * Without a database (a CLI with no DB, a test) the job simply runs.
 */
export function runExclusive(name, options, fn) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!sequelize()) {
            return fn();
        }
        yield ensureTable();
        if (!(yield acquire(name, options.ttlMs))) {
            return undefined;
        }
        try {
            return yield fn();
        }
        finally {
            if (options.release !== false) {
                yield release(name).catch(() => undefined);
            }
        }
    });
}
