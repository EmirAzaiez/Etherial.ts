"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQL = void 0;
const knex_1 = __importDefault(require("knex"));
class SQL {
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
    commands() {
        return [];
    }
}
exports.SQL = SQL;
//# sourceMappingURL=index.js.map