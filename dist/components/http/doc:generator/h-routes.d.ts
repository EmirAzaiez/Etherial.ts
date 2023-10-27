interface ClassDecoratorInfo {
    name: string;
    arguments: string[];
}
interface MethodDecoratorInfo {
    name: string;
    arguments: string[];
    decorators: ClassDecoratorInfo[];
    return?: any;
}
interface ClassInfo {
    name: string;
    decorators: ClassDecoratorInfo[];
    properties: MethodDecoratorInfo[];
    methods: {
        name: string;
        decorators: MethodDecoratorInfo[];
    }[];
}
export declare function extractRoutes(filePath: string): ClassInfo[];
export {};
