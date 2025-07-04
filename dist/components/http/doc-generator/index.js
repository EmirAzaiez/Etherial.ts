"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// import { extractRoutes } from "./h-routes";
const h_routes2_1 = require("./h-routes2");
const h_models_1 = require("./h-models");
const fs_1 = __importDefault(require("fs"));
// const routes = extractRoutes(__dirname + "/../../../../groci-api-etherial-ts/src/routes/users.ts")[0].properties
// const form = extractForm(__dirname + "/../../../../groci-api-etherial-ts/src/forms/user_form.ts")
exports.default = (etherial) => {
    let routes = [];
    let obj = {
        "openapi": "3.0.3",
        // "swagger": "2.0",
        "info": {
            "title": "Etherial API Doc",
            "description": "Etherial API DOC Generator",
            "license": {
                "name": "Apache 2.0",
                "url": "http://www.apache.org/licenses/LICENSE-2.0.html"
            },
            "version": "0.0.1"
        },
        "servers": [
            {
                "url": "http://localhost:3031"
            }
        ],
        // "components": {
        //     "securitySchemes": {
        //         "BearerAuth": {
        //             "type": "http",
        //             "scheme": "bearer"
        //         }
        //     }
        // },
        "paths": {},
        "components": {
            "schemas": (0, h_models_1.getSequelizeSchema)(etherial.database.sequelize).definitions
        },
    };
    const forms = {
    // "UserForm": form
    };
    console.log((0, h_routes2_1.extractRoutes)(`${process.cwd()}/src/routes/users_entities.ts`));
    fs_1.default.readdirSync(`${process.cwd()}/src/routes`).map((route) => {
        // console.log(extractRoutes(`${process.cwd()}/src/routes/${route}`))
        // routes = [...routes, ...extractRoutes(`${process.cwd()}/src/routes/${route}`)[0].properties]
    });
    routes.map((route) => {
        //@ts-ignore
        const method = route.decorators.find((el) => ["Post", "Put", "Delete", "Get"].includes(el.name));
        //@ts-ignore
        // const form = route.decorators.find((el) => el.name === "ShouldValidateForm")
        // //@ts-ignore
        // const authentificationNeeded = route.decorators.find((el) => el.name === "ShouldBeAuthentificate")
        // if (method.arguments[0] === "/users/me" && method.name === "Get") {
        //     console.log(method.arguments[0])
        //     if (obj["paths"][method.arguments[0]]) {
        //         obj["paths"][method.arguments[0]][method.name.toLowerCase()] = {
        //             responses: {
        //                 "200": {
        //                     description: "Test"
        //                 }
        //             }
        //         }
        //     } else {
        //         obj["paths"][method.arguments[0]] = {
        //             [method.name.toLowerCase()]: {
        //                 responses: {
        //                     "200": {
        //                         description: "Test"
        //                     }
        //                 }
        //             }
        //         }
        //     }
        // }
        // if (authentificationNeeded) {
        //     obj["paths"][method.arguments[0]][method.name.toLowerCase()]["security"] = {
        //         security: [{
        //             BearerAuth: []
        //         }],
        //     }
        // }
        // if (form) {
        //     const [formName] = form.arguments
        //     if (formName) {
        //         let split = formName.split('.')
        //         if (split) {
        //             let fff = forms[split[0]]
        //             if (fff) {
        //                 const ffff2 = fff.find((ffff1) => ffff1.name === split[1])
        //                 obj["paths"][method.arguments[0]][method.name.toLowerCase()]["requestBody"] = {
        //                     required: true,
        //                     content: {
        //                         "application/json": {
        //                             "schema": {
        //                                 "type": "object",
        //                                 "properties" : {}
        //                             }
        //                         }
        //                     }
        //                 }
        //                 ffff2.properties.map((property) => {
        //                     obj["paths"][method.arguments[0]][method.name.toLowerCase()]["requestBody"]["content"]["application/json"]["schema"]["properties"][property.name] = {
        //                         type: "string"
        //                     }
        //                 })
        //             }
        //         }
        //     }
        // }
    });
    return obj;
};
// fs.writeFileSync("./swagger.json", JSON.stringify(obj))
//# sourceMappingURL=index.js.map