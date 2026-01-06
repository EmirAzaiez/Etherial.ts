var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import 'reflect-metadata';
export class Etherial {
    constructor() {
        this.initDone = false;
        this.initInProgress = false;
    }
    /**
     * Get sorted module keys, with 'app' always last
     */
    getModuleKeys() {
        return Object.keys(this)
            .filter(key => !Etherial.RESERVED_KEYS.has(key) &&
            typeof this[key] === 'object' &&
            this[key] !== null)
            .sort((a, b) => {
            // 'app' always comes last
            if (a === 'app')
                return 1;
            if (b === 'app')
                return -1;
            return a.localeCompare(b);
        });
    }
    /**
     * Initialize Etherial with module configurations
     */
    init(config) {
        this.initInProgress = true;
        for (const name of Object.keys(config)) {
            if (this[name]) {
                console.warn(`Module "${name}" is already initialized, skipping.`);
                continue;
            }
            const component = config[name];
            if (!component.module) {
                throw new Error(`Module "${name}" is not a valid Etherial module. Missing 'module' property.`);
            }
            try {
                const moduleInstance = new component.module(component.config || {});
                this[name] = moduleInstance;
            }
            catch (error) {
                throw new Error(`Failed to initialize module "${name}": ${error.message}`);
            }
        }
    }
    /**
     * Run lifecycle: beforeRun → run → afterRun (in sequence)
     */
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const moduleKeys = this.getModuleKeys();
            try {
                // Phase 1: beforeRun (all modules in parallel)
                yield Promise.all(moduleKeys.map((key) => __awaiter(this, void 0, void 0, function* () {
                    const module = this[key];
                    if (module === null || module === void 0 ? void 0 : module.beforeRun) {
                        yield module.beforeRun(this);
                    }
                })));
                // Phase 2: run (all modules in parallel)
                yield Promise.all(moduleKeys.map((key) => __awaiter(this, void 0, void 0, function* () {
                    const module = this[key];
                    if (module === null || module === void 0 ? void 0 : module.run) {
                        yield module.run(this);
                    }
                })));
                // Mark initialization as complete
                this.initDone = true;
                this.initInProgress = false;
                // Phase 3: afterRun (all modules in parallel)
                yield Promise.all(moduleKeys.map((key) => __awaiter(this, void 0, void 0, function* () {
                    const module = this[key];
                    if (module === null || module === void 0 ? void 0 : module.afterRun) {
                        yield module.afterRun(this);
                    }
                })));
                return this;
            }
            catch (error) {
                this.initInProgress = false;
                throw new Error(`Etherial run failed: ${error.message}`);
            }
        });
    }
    /**
     * Collect all commands from modules
     */
    commands() {
        return __awaiter(this, void 0, void 0, function* () {
            const moduleKeys = this.getModuleKeys();
            const allCommands = [];
            for (const key of moduleKeys) {
                const module = this[key];
                if (module === null || module === void 0 ? void 0 : module.commands) {
                    const moduleCommands = module.commands(this);
                    // Prefix each command with the module name
                    for (const cmd of moduleCommands) {
                        allCommands.push(Object.assign(Object.assign({}, cmd), { command: `${key}:${cmd.command}` }));
                    }
                }
            }
            return allCommands;
        });
    }
}
// Reserved keys that should not be treated as modules
Etherial.RESERVED_KEYS = new Set(['initDone', 'initInProgress']);
Object.freeze(Etherial);
export default new Etherial();
//# sourceMappingURL=index.js.map