import * as fs from 'fs';
import * as ts from 'typescript';

interface ClassInfo {
    name: string;
    properties: PropertyInfo[];
}

interface PropertyInfo {
    name: string;
    decorators: {
        name: string;
        arguments: string[];
    }[];
}

export function extractForm(filePath: string): ClassInfo[] {
    const sourceFile = ts.createSourceFile(filePath, fs.readFileSync(filePath).toString(), ts.ScriptTarget.Latest);
    const classes: ClassInfo[] = [];

    function visit(node: ts.Node) {
        //@ts-ignore
        if (ts.isClassDeclaration(node) && node.decorators && node.decorators.length > 0) {
            const classInfo: ClassInfo = {
                name: '',
                properties: []
            };
            if (node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
                classInfo.name = node.name.text;
            }

            for (const member of node.members) {
                //@ts-ignore

                if (ts.isPropertyDeclaration(member) && member.decorators && member.decorators.length > 0) {
                    const propertyInfo: PropertyInfo = {
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
                            }

                            if (ts.isDecorator(d) && ts.isCallExpression(d.expression) && ts.isIdentifier(d.expression.expression)) {
                                obj.name = d.expression.expression.text;
                                obj.arguments = d.expression.arguments.map((arg) => {
                                    if (ts.isStringLiteral(arg)) {
                                        return arg.text
                                    }
                                });
                            }
                            return obj
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