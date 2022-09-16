"use strict";
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
const sequelize_typescript_1 = require("sequelize-typescript");
class Database {
    // add ifnore sync
    constructor({ server, port, name, username, password, dialect, models }) {
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
            this.sequelize.addModels([models]);
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
        return {
            'database:destroy': {
                arguments: {},
                callback: (args) => {
                    this.sequelize.sync({ force: true });
                }
            },
            'database:load:fixtures': {
                arguments: {
                    '--path': [String]
                },
                callback: (args) => { }
            }
        };
    }
}
exports.Database = Database;
//# sourceMappingURL=index.js.map