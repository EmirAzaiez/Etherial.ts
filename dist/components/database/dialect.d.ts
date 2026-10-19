/**
 * The few statements the framework's own small tables (locks, brute-force
 * counters) need that SQL dialects spell differently. Raw SQL rather than
 * models: these tables are created on first use, by a component, long after
 * the database synced.
 *
 * Postgres, MySQL/MariaDB and SQLite. Anything else gets the portable form.
 */
export type SqlDialect = 'postgres' | 'mysql' | 'mariadb' | 'sqlite' | string;
export declare function dialectOf(sequelize: any): SqlDialect;
/**
 * `CREATE TABLE IF NOT EXISTS`, retried once: two servers booting together
 * can both miss the table and race on creating it, and Postgres then fails the
 * loser on its catalog's unique index. The second try sees the table.
 */
export declare function createTableIfMissing(sequelize: any, ddl: string): Promise<void>;
/**
 * Inserts a row unless its key is taken, and says whether it went in.
 *
 * Not a plain INSERT caught on the duplicate: Postgres logs every unique
 * violation as an ERROR, and a lease that several servers try every minute
 * would fill the database's log with them. Each dialect has a quiet form.
 */
export declare function insertIfAbsent(sequelize: any, table: string, key: string, values: Record<string, unknown>, options?: {
    transaction?: any;
}): Promise<boolean>;
