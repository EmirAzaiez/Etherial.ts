var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Sequelize } from 'sequelize-typescript';
import * as sequelizeFixtures from 'sequelize-fixtures';
export class Database {
    constructor(config) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        this.models = [];
        this.validateConfig(config);
        this.config = config;
        const sequelizeOptions = {
            host: config.server,
            port: config.port,
            database: config.name,
            dialect: config.dialect,
            username: config.username,
            password: config.password,
            logging: (_a = config.logging) !== null && _a !== void 0 ? _a : false,
            define: {
                underscored: (_c = (_b = config.define) === null || _b === void 0 ? void 0 : _b.underscored) !== null && _c !== void 0 ? _c : true,
                timestamps: (_e = (_d = config.define) === null || _d === void 0 ? void 0 : _d.timestamps) !== null && _e !== void 0 ? _e : true,
                paranoid: (_g = (_f = config.define) === null || _f === void 0 ? void 0 : _f.paranoid) !== null && _g !== void 0 ? _g : false,
                freezeTableName: (_j = (_h = config.define) === null || _h === void 0 ? void 0 : _h.freezeTableName) !== null && _j !== void 0 ? _j : false,
            },
            timezone: (_k = config.timezone) !== null && _k !== void 0 ? _k : '+00:00',
        };
        if (config.dialect === 'sqlite') {
            sequelizeOptions.storage = (_l = config.storage) !== null && _l !== void 0 ? _l : ':memory:';
        }
        if (config.ssl) {
            sequelizeOptions.dialectOptions = {
                ssl: typeof config.ssl === 'boolean'
                    ? { rejectUnauthorized: false }
                    : config.ssl,
            };
        }
        this.sequelize = new Sequelize(sequelizeOptions);
        if (config.models) {
            this.models = config.models;
        }
    }
    validateConfig(config) {
        const required = ['server', 'port', 'name', 'username', 'password', 'dialect'];
        const missing = required.filter((key) => config[key] === undefined || config[key] === null);
        if (missing.length > 0) {
            throw new Error(`Database config missing required fields: ${missing.join(', ')}`);
        }
        const validDialects = ['mysql', 'postgres', 'sqlite', 'mariadb', 'mssql'];
        if (!validDialects.includes(config.dialect)) {
            throw new Error(`Invalid dialect "${config.dialect}". Must be one of: ${validDialects.join(', ')}`);
        }
    }
    beforeRun() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.models.length > 0) {
                this.sequelize.addModels(this.models);
            }
            yield this.sequelize.sync();
        });
    }
    addModels(models) {
        this.models = [...this.models, ...models];
    }
    sync(options) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.sequelize.sync(options);
        });
    }
    transaction(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.sequelize.transaction(callback);
        });
    }
    commands() {
        return [
            {
                command: 'destroy',
                description: 'Destroy database and recreate it (⚠️ DESTRUCTIVE)',
                warn: true,
                action: () => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield this.run();
                        yield this.sequelize.sync({ force: true });
                        return { success: true, message: 'Database destroyed and recreated successfully.' };
                    }
                    catch (error) {
                        return { success: false, message: error.message };
                    }
                }),
            },
            {
                command: 'migrate',
                description: 'Run pending migrations (alter mode)',
                warn: true,
                action: () => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield this.run();
                        yield this.sequelize.sync({ alter: true });
                        return { success: true, message: 'Migrations applied successfully.' };
                    }
                    catch (error) {
                        return { success: false, message: error.message };
                    }
                }),
            },
            {
                command: 'load:fixtures <env>',
                description: 'Load fixtures (⚠️ destroys existing data)',
                warn: true,
                action: (_etherial, env) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield this.run();
                        yield this.sequelize.sync({ force: true });
                        const fixturePath = `${process.cwd()}/fixtures/${env}.json`;
                        yield sequelizeFixtures.loadFile(fixturePath, this.sequelize.models);
                        return { success: true, message: `Fixtures from ${env}.json loaded successfully.` };
                    }
                    catch (error) {
                        return { success: false, message: error.message };
                    }
                }),
            }
        ];
    }
}
