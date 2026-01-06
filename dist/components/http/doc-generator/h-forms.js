import * as fs from 'fs';
import * as ts from 'typescript';
export function extractForm(filePath) {
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
//# sourceMappingURL=h-forms.js.map