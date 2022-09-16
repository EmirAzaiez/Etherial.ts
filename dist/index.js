"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
class Etherial {
    constructor() {
        this.initDone = false;
        this.initInProgress = false;
    }
    init(config) {
        this.initInProgress = true;
        Object.keys(config).forEach((element) => {
            if (!this[element]) {
                let component = config[element];
                this[element] = new component['module'](component.config);
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
    commands() { }
}
exports.Etherial = Etherial;
Object.freeze(Etherial);
exports.default = new Etherial();
//# sourceMappingURL=index.js.map