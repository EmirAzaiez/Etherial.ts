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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const knex_1 = __importDefault(require("knex"));
class Database {
    // add ignore sync
    constructor({ server, port, name, username, password, dialect }) {
        this.etherial_module_name = 'sql';
        this.knex = (0, knex_1.default)({
            client: dialect,
            connection: {
                host: server,
                port: port,
                user: username,
                password: password,
                database: name,
            },
        });
        return this;
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            // await this.sequelize.sync()
        });
    }
    commands() {
        return [];
    }
}
exports.Database = Database;
//# sourceMappingURL=index.js.map