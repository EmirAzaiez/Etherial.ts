var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import knex from 'knex';
export class RawSQL {
    constructor(config) {
        var _a;
        this.validateConfig(config);
        this.config = config;
        const connectionConfig = {
            host: config.server,
            port: config.port,
            user: config.username,
            password: config.password,
            database: config.name,
        };
        if (config.ssl) {
            connectionConfig.ssl =
                typeof config.ssl === 'boolean'
                    ? { rejectUnauthorized: false }
                    : config.ssl;
        }
        this.knex = knex({
            client: config.dialect,
            connection: connectionConfig,
            pool: (_a = config.pool) !== null && _a !== void 0 ? _a : { min: 0, max: 10 },
        });
    }
    validateConfig(config) {
        const required = [
            'server',
            'port',
            'name',
            'username',
            'password',
            'dialect',
        ];
        const missing = required.filter((key) => config[key] === undefined || config[key] === null);
        if (missing.length > 0) {
            throw new Error(`RawSQL config missing required fields: ${missing.join(', ')}`);
        }
        const validDialects = [
            'mysql',
            'mysql2',
            'pg',
            'sqlite3',
            'mssql',
            'oracledb',
        ];
        if (!validDialects.includes(config.dialect)) {
            throw new Error(`Invalid dialect "${config.dialect}". Must be one of: ${validDialects.join(', ')}`);
        }
    }
    /**
     * Execute a raw SQL query
     */
    raw(sql, bindings) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.knex.raw(sql, bindings);
            return result;
        });
    }
    /**
     * Start a query on a specific table
     */
    table(tableName) {
        return this.knex(tableName);
    }
    /**
     * Execute queries within a transaction
     */
    transaction(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.knex.transaction(callback);
        });
    }
    /**
     * Destroy the connection pool
     */
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.knex.destroy();
        });
    }
    beforeRun() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    commands() {
        return [
            {
                command: 'ping',
                description: 'Test database connection',
                action: () => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield this.knex.raw('SELECT 1');
                        return { success: true, message: 'Connection successful!' };
                    }
                    catch (error) {
                        return { success: false, message: error.message };
                    }
                }),
            },
        ];
    }
}
