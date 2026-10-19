import { QueryTypes, UniqueConstraintError } from 'sequelize'

/**
 * The few statements the framework's own small tables (locks, brute-force
 * counters) need that SQL dialects spell differently. Raw SQL rather than
 * models: these tables are created on first use, by a component, long after
 * the database synced.
 *
 * Postgres, MySQL/MariaDB and SQLite. Anything else gets the portable form.
 */

export type SqlDialect = 'postgres' | 'mysql' | 'mariadb' | 'sqlite' | string

export function dialectOf(sequelize: any): SqlDialect {
    return sequelize?.getDialect?.() ?? 'postgres'
}

/**
 * `CREATE TABLE IF NOT EXISTS`, retried once: two servers booting together
 * can both miss the table and race on creating it, and Postgres then fails the
 * loser on its catalog's unique index. The second try sees the table.
 */
export async function createTableIfMissing(sequelize: any, ddl: string): Promise<void> {
    try {
        await sequelize.query(ddl)
    } catch {
        await sequelize.query(ddl)
    }
}

/**
 * Inserts a row unless its key is taken, and says whether it went in.
 *
 * Not a plain INSERT caught on the duplicate: Postgres logs every unique
 * violation as an ERROR, and a lease that several servers try every minute
 * would fill the database's log with them. Each dialect has a quiet form.
 */
export async function insertIfAbsent(
    sequelize: any,
    table: string,
    key: string,
    values: Record<string, unknown>,
    options: { transaction?: any } = {}
): Promise<boolean> {
    const columns = Object.keys(values)
    const list = columns.join(', ')
    const params = columns.map((column) => `:${column}`).join(', ')
    const dialect = dialectOf(sequelize)

    let sql = `INSERT INTO ${table} (${list}) VALUES (${params})`
    if (dialect === 'postgres') {
        sql += ` ON CONFLICT (${key}) DO NOTHING`
    } else if (dialect === 'mysql' || dialect === 'mariadb') {
        sql = `INSERT IGNORE INTO ${table} (${list}) VALUES (${params})`
    } else if (dialect === 'sqlite') {
        sql = `INSERT OR IGNORE INTO ${table} (${list}) VALUES (${params})`
    }

    try {
        const [, inserted] = await sequelize.query(sql, {
            replacements: values,
            type: QueryTypes.INSERT,
            transaction: options.transaction,
        })
        // Postgres, MySQL and SQLite all report the rows written here.
        return inserted === undefined ? true : Number(inserted) > 0
    } catch (err) {
        if (err instanceof UniqueConstraintError) {
            return false
        }
        throw err
    }
}
