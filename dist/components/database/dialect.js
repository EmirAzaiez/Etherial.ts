var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { QueryTypes, UniqueConstraintError } from 'sequelize';
export function dialectOf(sequelize) {
    var _a, _b;
    return (_b = (_a = sequelize === null || sequelize === void 0 ? void 0 : sequelize.getDialect) === null || _a === void 0 ? void 0 : _a.call(sequelize)) !== null && _b !== void 0 ? _b : 'postgres';
}
/**
 * `CREATE TABLE IF NOT EXISTS`, retried once: two servers booting together
 * can both miss the table and race on creating it, and Postgres then fails the
 * loser on its catalog's unique index. The second try sees the table.
 */
export function createTableIfMissing(sequelize, ddl) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield sequelize.query(ddl);
        }
        catch (_a) {
            yield sequelize.query(ddl);
        }
    });
}
/**
 * Inserts a row unless its key is taken, and says whether it went in.
 *
 * Not a plain INSERT caught on the duplicate: Postgres logs every unique
 * violation as an ERROR, and a lease that several servers try every minute
 * would fill the database's log with them. Each dialect has a quiet form.
 */
export function insertIfAbsent(sequelize_1, table_1, key_1, values_1) {
    return __awaiter(this, arguments, void 0, function* (sequelize, table, key, values, options = {}) {
        const columns = Object.keys(values);
        const list = columns.join(', ');
        const params = columns.map((column) => `:${column}`).join(', ');
        const dialect = dialectOf(sequelize);
        let sql = `INSERT INTO ${table} (${list}) VALUES (${params})`;
        if (dialect === 'postgres') {
            sql += ` ON CONFLICT (${key}) DO NOTHING`;
        }
        else if (dialect === 'mysql' || dialect === 'mariadb') {
            sql = `INSERT IGNORE INTO ${table} (${list}) VALUES (${params})`;
        }
        else if (dialect === 'sqlite') {
            sql = `INSERT OR IGNORE INTO ${table} (${list}) VALUES (${params})`;
        }
        try {
            const [, inserted] = yield sequelize.query(sql, {
                replacements: values,
                type: QueryTypes.INSERT,
                transaction: options.transaction,
            });
            // Postgres, MySQL and SQLite all report the rows written here.
            return inserted === undefined ? true : Number(inserted) > 0;
        }
        catch (err) {
            if (err instanceof UniqueConstraintError) {
                return false;
            }
            throw err;
        }
    });
}
