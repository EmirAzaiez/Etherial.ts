"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactiveTable = exports.ReactiveTableForwardType = exports.ReactiveTableHookType = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const index_1 = __importDefault(require("../../index"));
var ReactiveTableHookType;
(function (ReactiveTableHookType) {
    ReactiveTableHookType["CREATE"] = "create";
    ReactiveTableHookType["UPDATE"] = "update";
    ReactiveTableHookType["DELETE"] = "delete";
})(ReactiveTableHookType = exports.ReactiveTableHookType || (exports.ReactiveTableHookType = {}));
var ReactiveTableForwardType;
(function (ReactiveTableForwardType) {
    ReactiveTableForwardType["ROOMS"] = "rooms";
    ReactiveTableForwardType["USERS"] = "users";
})(ReactiveTableForwardType = exports.ReactiveTableForwardType || (exports.ReactiveTableForwardType = {}));
const ReactiveTable = (options) => {
    return function (target, propertyKey) {
        if (!options.hook) {
            options.hooks = {};
        }
        if (options.reactive) {
            const createHook = (func, type) => {
                return (instance) => {
                    func({
                        instance: instance,
                        forwardToUsers: (ids, newInstance = instance) => {
                            ids.map((id) => {
                                index_1.default["reactive"].io.to(`user_${id}`).emit("reactive", {
                                    action: type,
                                    model: newInstance.constructor.name,
                                    data: JSON.parse(JSON.stringify(instance))
                                });
                            });
                        },
                        forwardToRooms: (rooms, newInstance = instance) => {
                            rooms.forEach((room) => {
                                index_1.default["reactive"].io.to(room).emit("reactive", {
                                    action: type,
                                    model: newInstance.constructor.name,
                                    data: JSON.parse(JSON.stringify(instance))
                                });
                            });
                        }
                    });
                };
            };
            if (options.reactive[ReactiveTableHookType.CREATE]) {
                options.hooks.afterCreate = createHook(options.reactive[ReactiveTableHookType.CREATE], ReactiveTableHookType.CREATE);
            }
            if (options.reactive[ReactiveTableHookType.UPDATE]) {
                options.hooks.afterUpdate = createHook(options.reactive[ReactiveTableHookType.UPDATE], ReactiveTableHookType.UPDATE);
            }
            if (options.reactive[ReactiveTableHookType.DELETE]) {
                options.hooks.afterDestroy = createHook(options.reactive[ReactiveTableHookType.DELETE], ReactiveTableHookType.DELETE);
            }
        }
        delete options.reactive;
        return (0, sequelize_typescript_1.Table)(options)(target, propertyKey);
    };
};
exports.ReactiveTable = ReactiveTable;
//# sourceMappingURL=provider.js.map