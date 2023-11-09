"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const sequelizeFixtures = __importStar(require("sequelize-fixtures"));
class Database {
    // add ignore sync
    constructor({ server, port, name, username, password, dialect, models }) {
        this.etherial_module_name = 'database';
        this.sequelize = new sequelize_typescript_1.Sequelize({
            host: server,
            port: port,
            database: name,
            dialect: dialect,
            username: username,
            password: password,
            storage: ':memory:',
            logging: false,
            define: {
                underscored: true
            }
        });
        if (models) {
            this.addModels(models);
        }
        return this;
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.sequelize.sync();
        });
    }
    addModels(models) {
        this.sequelize.addModels(models);
        return this;
    }
    sync() {
        this.sequelize.sync();
    }
    commands() {
        return [
            {
                command: 'destroy',
                description: 'Destroy database for recreate it properly.',
                warn: true,
                action: () => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield this.sequelize.sync({ force: true });
                        return { success: true, message: 'Database destroyed successfully.' };
                    }
                    catch (error) {
                        return { success: false, message: error.message };
                    }
                })
            },
            {
                command: 'load:fixtures <env>',
                description: 'Load fixtures in database (This will destroy the database also).',
                warn: false,
                action: (etherial, env) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        yield this.sequelize.sync({ force: true });
                        yield sequelizeFixtures.loadFile(`${process.cwd()}/fixtures/${env}.json`, this.sequelize.models);
                        return { success: true, message: 'Fixtures loaded successfully.' };
                    }
                    catch (error) {
                        return { success: false, message: error.message };
                    }
                })
            }
        ];
    }
}
exports.Database = Database;
//# sourceMappingURL=index.js.map