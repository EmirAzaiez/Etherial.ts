/**
 * Leaf configuration interface
 */
export interface LeafConfig {
    name: string;
    version: string;
    description: string;
    author?: string;
    config_key?: string;
    dependencies: string[];
    requirements?: LeafRequirement[];
    mandatory_models?: MandatoryModel[];
    npm_dependencies?: Record<string, string>;
    env: LeafEnvVar[];
    config: {
        import: string;
        example: Record<string, unknown>;
    };
    models?: string[];
    routes?: Record<string, {
        description: string;
        methods: string[];
    }>;
    services?: string[];
    commands?: {
        name: string;
        description: string;
    }[];
}
export interface MandatoryModel {
    name: string;
    base_class: string;
    description: string;
}
export interface LeafEnvVar {
    key: string;
    description: string;
    required: boolean;
    example: string;
    default?: string;
}
export interface LeafRequirement {
    type: 'model' | 'file' | 'directory';
    name: string;
    path?: string;
    description: string;
    hint?: string;
}
/**
 * Get the path to the etherial leafs folder
 */
export declare function getEtherialLeafsPath(): string;
/**
 * List all available Leafs
 */
export declare function getAvailableLeafs(): string[];
/**
 * Check if a Leaf exists
 */
export declare function leafExists(leafName: string): boolean;
/**
 * Get leaf configuration from leaf.json
 */
export declare function getLeafConfig(leafName: string): LeafConfig | null;
/**
 * Check if a leaf has a leaf.json configuration
 */
export declare function hasLeafConfig(leafName: string): boolean;
