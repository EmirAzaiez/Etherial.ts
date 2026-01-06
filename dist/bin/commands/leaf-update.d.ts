interface LeafUpdateOptions {
    force: boolean;
}
export declare function leafUpdateCommand(leafName: string | undefined, options: LeafUpdateOptions): Promise<void>;
export {};
