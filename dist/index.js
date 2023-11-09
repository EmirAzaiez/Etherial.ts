"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Etherial = void 0;
require("reflect-metadata");
class Etherial {
    constructor() {
        this.initDone = false;
        this.initInProgress = false;
    }
    init(config) {
        this.initInProgress = true;
        Object.keys(config).forEach((name) => {
            if (!this[name]) {
                let component = config[name];
                if (component.module && component.module) {
                    //@ts-ignore
                    let moduleInstance = new component.module(component.config);
                    if (moduleInstance.etherial_module_name === name) {
                        this[name] = moduleInstance;
                    }
                    else {
                        throw new Error(`Module ${name} defined in config should has this name: ${moduleInstance.etherial_module_name}.`);
                    }
                }
                else {
                    throw new Error(`Module ${name} is not a valid Etherial module.`);
                }
            }
        });
    }
    run() {
        let promises = [];
        Object.keys(this).sort((a, b) => {
            return (a === 'app' ? 1 : 0) - (b === 'app' ? 1 : 0) || +(a > b) || -(a < b);
        }).forEach((element) => {
            if (this[element].run) {
                let rtn = this[element].run(this);
                if (rtn instanceof Promise) {
                    promises.push(rtn);
                }
            }
        });
        return new Promise((resolve) => {
            Promise.all(promises).then(() => {
                this.initDone = true;
                this.initInProgress = false;
                resolve(this);
            });
        });
    }
    commands() {
        return new Promise((resolve) => {
            let promises = [];
            Object.keys(this).sort((a, b) => {
                return (a === 'app' ? 1 : 0) - (b === 'app' ? 1 : 0) || +(a > b) || -(a < b);
            }).forEach((element) => {
                if (this[element].commands) {
                    let rtn = this[element].commands(this);
                    promises.push(rtn.map((single) => {
                        return Object.assign(Object.assign({}, single), { command: `${element}:${single.command}` });
                    }));
                }
            });
            resolve(promises);
        });
    }
}
exports.Etherial = Etherial;
Object.freeze(Etherial);
exports.default = new Etherial();
//# sourceMappingURL=index.js.map