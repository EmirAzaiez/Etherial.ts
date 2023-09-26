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
exports.ReactiveTable = void 0;
const sequelize_typescript_1 = require("sequelize-typescript");
const index_1 = __importDefault(require("../../index"));
const ReactiveTable = (options) => {
    const generateHook = (cb, type) => {
        return (instance) => __awaiter(void 0, void 0, void 0, function* () {
            let rtnOptions = yield cb(instance);
            let rooms = [];
            if (rtnOptions.instance) {
                instance = rtnOptions.instance;
            }
            if (rtnOptions.users) {
                rooms = [...rooms, rtnOptions.users.map((id) => `user_${id}`)];
            }
            if (rtnOptions.rooms) {
                rooms = [...rooms, ...rtnOptions.rooms];
            }
            rooms.forEach((room) => {
                index_1.default["reactive"].io.to(room).emit("reactive", {
                    action: type,
                    model: instance.constructor.name,
                    data: JSON.parse(JSON.stringify(instance))
                });
            });
        });
    };
    return function (target) {
        if (!options.hook) {
            options.hooks = {};
        }
        if (options.reactive) {
            options.reactive({
                onCreate: (cb) => options.hooks.afterCreate = generateHook(cb, "create"),
                onUpdate: (cb) => options.hooks.afterUpdate = generateHook(cb, "update"),
                onDelete: (cb) => options.hooks.afterDestroy = generateHook(cb, "delete"),
                onAll: (cb) => {
                    options.hooks.afterCreate = generateHook(cb, "create");
                    options.hooks.afterUpdate = generateHook(cb, "update");
                    options.hooks.afterDestroy = generateHook(cb, "delete");
                }
            });
            delete options.reactive;
        }
        return (0, sequelize_typescript_1.Table)(options)(target);
    };
};
exports.ReactiveTable = ReactiveTable;
//# sourceMappingURL=provider.js.map