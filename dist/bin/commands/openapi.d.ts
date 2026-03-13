export declare function openapiCommand(): Promise<void>;
export declare const command: {
    name: string;
    description: string;
    action: typeof openapiCommand;
};
