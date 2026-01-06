import * as fs from 'fs';
import * as ts from 'typescript';
export function extractRoutes(filePath) {
    console.log(filePath);
    const sourceFile = ts.createSourceFile(filePath, fs.readFileSync(filePath).toString(), ts.ScriptTarget.Latest);
    const classes = [];
    const program = ts.createProgram([filePath], { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });
    const checker = program.getTypeChecker();
    function visit(node) {
        //@ts-ignore
        if (ts.isClassDeclaration(node) && node.decorators && node.decorators.length > 0) {
            console.log("yooo ??");
            const classInfo = {
                name: '',
                decorators: [],
                methods: [],
                properties: []
            };
            if (node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
                classInfo.name = node.name.text;
            }
            //@ts-ignore
            if (node.decorators) {
                //@ts-ignore
                classInfo.decorators = node.decorators.map((d) => {
                    let obj = {
                        name: "",
                        arguments: []
                    };
                    if (ts.isDecorator(d) && ts.isCallExpression(d.expression) && ts.isIdentifier(d.expression.expression)) {
                        obj.name = d.expression.expression.text;
                        obj.arguments = d.expression.arguments.map((arg) => {
                            if (ts.isStringLiteral(arg)) {
                                return arg.text;
                            }
                        });
                    }
                    return obj;
                });
            }
            for (const member of node.members) {
                //@ts-ignore
                if (ts.isMethodDeclaration(member) && member.decorators && member.decorators.length > 0) {
                    if (member.name && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))) {
                        if (member.name.text === "getUser") {
                            if (ts.isMethodDeclaration(member)) {
                                console.log(program.getTypeChecker().getTypeAtLocation(node));
                            }
                        }
                    }
                    const methodInfo = {
                        name: '',
                        decorators: [],
                        arguments: [],
                        return: null
                    };
                    if (member.name && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))) {
                        methodInfo.name = member.name.text;
                    }
                    //@ts-ignore
                    if (member.decorators) {
                        //@ts-ignore
                        methodInfo.decorators = member.decorators.map((d) => {
                            let obj = {
                                name: "",
                                arguments: []
                            };
                            if (ts.isDecorator(d) && ts.isCallExpression(d.expression) && ts.isIdentifier(d.expression.expression)) {
                                obj.name = d.expression.expression.text;
                                obj.arguments = d.expression.arguments.map((arg) => {
                                    //@ts-ignore
                                    if (arg.name && arg.expression) {
                                        //@ts-ignore
                                        return `${arg.expression.escapedText}.${arg.name.escapedText}`;
                                    }
                                    if (ts.isStringLiteral(arg)) {
                                        return arg.text;
                                    }
                                });
                            }
                            return obj;
                        });
                    }
                    classInfo.properties.push(methodInfo);
                }
            }
            classes.push(classInfo);
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return classes;
}
//# sourceMappingURL=h-routes.js.map