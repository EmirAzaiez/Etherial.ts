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
export declare function extractForm(filePath: string): ClassInfo[];
export {};
