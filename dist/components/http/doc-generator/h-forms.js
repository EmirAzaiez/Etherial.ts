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
exports.extractForm = void 0;
const fs = __importStar(require("fs"));
const ts = __importStar(require("typescript"));
function extractForm(filePath) {
    const sourceFile = ts.createSourceFile(filePath, fs.readFileSync(filePath).toString(), ts.ScriptTarget.Latest);
    const classes = [];
    function visit(node) {
        //@ts-ignore
        if (ts.isClassDeclaration(node) && node.decorators && node.decorators.length > 0) {
            const classInfo = {
                name: '',
                properties: []
            };
            if (node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
                classInfo.name = node.name.text;
            }
            for (const member of node.members) {
                //@ts-ignore
                if (ts.isPropertyDeclaration(member) && member.decorators && member.decorators.length > 0) {
                    const propertyInfo = {
                        name: '',
                        decorators: []
                    };
                    if (member.name && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))) {
                        propertyInfo.name = member.name.text;
                    }
                    //@ts-ignore
                    if (member.decorators) {
                        //@ts-ignore
                        propertyInfo.decorators = member.decorators.map((d) => {
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
                    classInfo.properties.push(propertyInfo);
                }
            }
            classes.push(classInfo);
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return classes;
}
exports.extractForm = extractForm;
//# sourceMappingURL=h-forms.js.map