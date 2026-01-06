interface LeafAddOptions {
    force: boolean;
    skipDeps: boolean;
    skipRequirements: boolean;
}
export declare function leafAddCommand(leafName: string, options: LeafAddOptions): Promise<void>;
export {};
