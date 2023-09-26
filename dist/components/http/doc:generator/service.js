"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const h_forms_1 = require("./h-forms");
const h_routes_1 = require("./h-routes");
const fs_1 = __importDefault(require("fs"));
const routes = (0, h_routes_1.extractRoutes)(__dirname + "/../../../../groci-api-etherial-ts/src/routes/users.ts")[0].properties;
const form = (0, h_forms_1.extractForm)(__dirname + "/../../../../groci-api-etherial-ts/src/forms/user_form.ts");
let obj = {
    "openapi": "3.0.3",
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
    "components": {
        "securitySchemes": {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer"
            }
        }
    },
    "paths": {},
};
const forms = {
    "UserForm": form
};
routes.map((route) => {
    //@ts-ignore
    const method = route.decorators.find((el) => ["Post", "Put", "Delete", "Get"].includes(el.name));
    //@ts-ignore
    const form = route.decorators.find((el) => el.name === "ShouldValidateForm");
    //@ts-ignore
    const authentificationNeeded = route.decorators.find((el) => el.name === "ShouldBeAuthentificate");
    if (obj["paths"][method.arguments[0]]) {
        obj["paths"][method.arguments[0]][method.name.toLowerCase()] = {
            responses: {
                "200": {
                    data: {}
                }
            }
        };
    }
    else {
        obj["paths"][method.arguments[0]] = {
            [method.name.toLowerCase()]: {
                responses: {
                    "200": {
                        data: {}
                    }
                }
            }
        };
    }
    if (authentificationNeeded) {
        obj["paths"][method.arguments[0]][method.name.toLowerCase()]["security"] = {
            security: [{
                    BearerAuth: []
                }],
        };
    }
    if (form) {
        const [formName] = form.arguments;
        if (formName) {
            let split = formName.split('.');
            if (split) {
                let fff = forms[split[0]];
                if (fff) {
                    const ffff2 = fff.find((ffff1) => ffff1.name === split[1]);
                    obj["paths"][method.arguments[0]][method.name.toLowerCase()]["requestBody"] = {
                        required: true,
                        content: {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {}
                                }
                            }
                        }
                    };
                    ffff2.properties.map((property) => {
                        obj["paths"][method.arguments[0]][method.name.toLowerCase()]["requestBody"]["content"]["application/json"]["schema"]["properties"][property.name] = {
                            type: "string"
                        };
                    });
                }
            }
        }
    }
});
fs_1.default.writeFileSync("./swagger.json", JSON.stringify(obj));
//# sourceMappingURL=service.js.map