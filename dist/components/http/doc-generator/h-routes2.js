// const fs = require('fs')
// const esprima = require('esprima')
// export function extractRoutes(fileName: string) {
//     let file = fs.readFileSync(fileName).toString()
//     let ast = esprima.parseScript(file, { loc: true })
//     console.log(ast)
// }
import { Project } from "ts-morph";
const project = new Project();
project.addSourceFilesAtPaths("**/*.ts");
function extractFormName(url) {
    // Split the URL by '/'
    const parts = url.split('/');
    // Get the last part of the array
    const formName = parts[parts.length - 1];
    return formName;
}
export function extractRoutes(fileName) {
    let routes = [];
    const sourceFile = project.getSourceFileOrThrow(fileName);
    const structure = sourceFile.getStructure();
    if (structure.kind === 36 && structure.statements instanceof Array) {
        let forms = {};
        structure.statements.map((statement) => {
            if (statement.kind === 16) {
                if (statement.moduleSpecifier.includes("/forms/")) {
                    forms[statement.namespaceImport] = extractFormName(statement.moduleSpecifier);
                }
            }
            //@ts-ignore
            if (statement && statement.kind === 2 && statement.methods instanceof Array) {
                //@ts-ignore
                statement.methods.map((method) => {
                    let route = {
                        name: "",
                        method: "",
                        path: "",
                        return_type: "",
                        should_be_authentificate: false,
                        forms: []
                    };
                    route["name"] = method.name;
                    route["return_type"] = method.returnType;
                    //@ts-ignore
                    method.decorators.map((decorator) => {
                        if (decorator.name === "Post") {
                            route["method"] = "POST";
                            route["path"] = decorator.arguments[0];
                        }
                        if (decorator.name === "Get") {
                            route["method"] = "GET";
                            route["path"] = decorator.arguments[0];
                        }
                        if (decorator.name === "Put") {
                            route["method"] = "PUT";
                            route["path"] = decorator.arguments[0];
                        }
                        if (decorator.name === "Delete") {
                            route["method"] = "DELETE";
                            route["path"] = decorator.arguments[0];
                        }
                        if (decorator.name === "ShouldBeAuthentificate") {
                            route["should_be_authentificate"] = true;
                        }
                        if (decorator.name === "ShouldValidateForm") {
                            let formName = decorator.arguments[0].split('.');
                            route["forms"].push({
                                form: formName[0],
                                name: formName[1],
                                file: forms[formName[0]]
                            });
                        }
                    });
                    routes.push(route);
                });
            }
        });
        console.log(routes[0]);
        console.log(routes[1]);
        console.log(routes[2]);
        console.log(routes[3]);
    }
    // console.log(routes)
}
//# sourceMappingURL=h-routes2.js.map