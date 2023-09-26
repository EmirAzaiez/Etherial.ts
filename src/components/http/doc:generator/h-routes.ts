import * as fs from 'fs';
import * as ts from 'typescript';

interface ClassDecoratorInfo {
    name: string;
    arguments: string[];
}

interface MethodDecoratorInfo {
    name: string;
    arguments: string[];
    decorators: ClassDecoratorInfo[];
}

interface ClassInfo {
    name: string;
    decorators: ClassDecoratorInfo[];
    properties: MethodDecoratorInfo[]
    methods: {
        name: string;
        decorators: MethodDecoratorInfo[];
    }[];
}

export function extractRoutes(filePath: string): ClassInfo[] {
    const sourceFile = ts.createSourceFile(filePath, fs.readFileSync(filePath).toString(), ts.ScriptTarget.Latest);
    const classes: ClassInfo[] = [];

    function visit(node: ts.Node) {
        if (ts.isClassDeclaration(node) && node.decorators && node.decorators.length > 0) {
            const classInfo: ClassInfo = {
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
                    }

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
                    const methodInfo: MethodDecoratorInfo = {
                        name: '',
                        decorators: [],
                        arguments: []
                    };
                    if (member.name && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))) {
                        methodInfo.name = member.name.text;
                    }
                    if (member.decorators) {
                        methodInfo.decorators = member.decorators.map((d) => {
                            let obj = {
                                name: "",
                                arguments: []
                            }

                            if (ts.isDecorator(d) && ts.isCallExpression(d.expression) && ts.isIdentifier(d.expression.expression)) {
                                obj.name = d.expression.expression.text;
                                obj.arguments = d.expression.arguments.map((arg) => {
                                    
                                    //@ts-ignore
                                    if (arg.name && arg.expression) {
                                        //@ts-ignore
                                        return `${arg.expression.escapedText}.${arg.name.escapedText}`
                                    }

                                    if (ts.isStringLiteral(arg)) {
                                        return arg.text;
                                    }
                                    
                                });
                            }
                            return obj
                        })
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