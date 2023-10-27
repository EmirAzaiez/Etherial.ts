"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractRoutes = void 0;
const fs = __importStar(require("fs"));
const ts = __importStar(require("typescript"));
function extractRoutes(filePath) {
    const sourceFile = ts.createSourceFile(filePath, fs.readFileSync(filePath).toString(), ts.ScriptTarget.Latest);
    const classes = [];
    const program = ts.createProgram([filePath], { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS });
    const checker = program.getTypeChecker();
    function visit(node) {
        if (ts.isClassDeclaration(node) && node.decorators && node.decorators.length > 0) {
            const classInfo = {
                name: '',
                decorators: [],
                methods: [],
                properties: []
            };
            if (node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
                classInfo.name = node.name.text;
            }
            if (node.decorators) {
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
                    if (member.decorators) {
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
exports.extractRoutes = extractRoutes;
//# sourceMappingURL=h-routes.js.map