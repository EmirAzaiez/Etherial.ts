"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const colors = __importStar(require("colors"));
const arg_1 = __importDefault(require("arg"));
colors.setTheme({
    info: 'green',
    warn: 'yellow',
    error: 'red'
});
class Etherial {
    init(config) {
        Object.keys(config).forEach((element) => {
            if (!this[element]) {
                let component = config[element];
                this[element] = new component['module'](component.config);
            }
        });
        return this;
    }
    run() {
        Object.keys(this).sort((a, b) => {
            return (a === 'app' ? 1 : 0) - (b === 'app' ? 1 : 0) || +(a > b) || -(a < b);
        }).forEach((element) => {
            if (this[element].run) {
                this[element].run(this);
            }
        });
        return this;
    }
    commands() {
        let commands = {};
        let command = process.argv[2];
        Object.keys(this).forEach((element) => {
            if (this[element].commands) {
                let cmds = this[element].commands();
                Object.keys(cmds).forEach((cmd) => {
                    commands[cmd] = cmds[cmd];
                });
            }
        });
        if (commands[command]) {
            const args = arg_1.default((commands[command].arguments || {}));
            commands[command].callback(args);
        }
        else {
            console.log(`Command ${command} not found, type --help for more informations.`);
        }
    }
}
Object.freeze(Etherial);
exports.default = new Etherial();
//# sourceMappingURL=index.js.map