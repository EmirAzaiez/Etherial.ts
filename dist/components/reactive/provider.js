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
            const createHook = (func) => {
                return (instance) => {
                    func({
                        instance: instance,
                        forwardToUsers: (ids, newInstance = instance) => {
                            ids.map((id) => {
                                index_1.default["http_database_reactive"].io.to(`user_${id}`, {
                                    data: JSON.parse(JSON.stringify(instance))
                                });
                            });
                        },
                        forwardToRooms: (rooms, newInstance = instance) => {
                            rooms.forEach((room) => {
                                index_1.default["http_database_reactive"].io.to(room, {
                                    data: JSON.parse(JSON.stringify(instance))
                                });
                            });
                        }
                    });
                };
            };
            if (options.reactive[ReactiveTableHookType.CREATE]) {
                options.hooks.afterCreate = createHook(options.reactive[ReactiveTableHookType.CREATE]);
            }
            if (options.reactive[ReactiveTableHookType.UPDATE]) {
                options.hooks.afterUpdate = createHook(options.reactive[ReactiveTableHookType.UPDATE]);
            }
            if (options.reactive[ReactiveTableHookType.DELETE]) {
                options.hooks.afterDelete = createHook(options.reactive[ReactiveTableHookType.DELETE]);
            }
        }
        delete options.reactive;
        return (0, sequelize_typescript_1.Table)(options)(target, propertyKey);
    };
};
exports.ReactiveTable = ReactiveTable;
// let test = {
//     [ReactiveTableHookType.CREATE]: ({forwardToRooms, instance}) => {
//         forwardToRooms(["users"])
//     }
// }
//# sourceMappingURL=provider.js.map