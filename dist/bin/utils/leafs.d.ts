/**
 * Leaf configuration interface
 */
export interface LeafConfig {
    name: string;
    version: string;
    description: string;
    author?: string;
    dependencies: string[];
    requirements?: LeafRequirement[];
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
 * Recursively copy a directory
 */
export declare function copyDirRecursive(src: string, dest: string): void;
/**
 * Copy a Leaf into the project
 */
export declare function copyLeafToProject(leafName: string, projectPath?: string): {
    success: boolean;
    destPath: string;
    error?: string;
};
/**
 * Check if a Leaf is installed in the project
 */
export declare function isLeafInstalledInProject(leafName: string, projectPath?: string): boolean;
/**
 * Remove a Leaf from the project
 */
export declare function removeLeafFromProject(leafName: string, projectPath?: string): boolean;
/**
 * Get leaf configuration from leaf.json
 */
export declare function getLeafConfig(leafName: string): LeafConfig | null;
/**
 * Check if a leaf has a leaf.json configuration
 */
export declare function hasLeafConfig(leafName: string): boolean;
/**
 * Get all missing dependencies for a leaf (recursively)
 */
export declare function getMissingDependencies(leafName: string, projectPath?: string): string[];
/**
 * Get leaves to install in the correct order (dependencies first)
 */
export declare function getInstallOrder(leafName: string, projectPath?: string): string[];
export interface RequirementCheckResult {
    satisfied: boolean;
    requirement: LeafRequirement;
    foundPath?: string;
}
/**
 * Check if a specific requirement is satisfied
 */
export declare function checkRequirement(requirement: LeafRequirement, projectPath?: string): RequirementCheckResult;
/**
 * Check all requirements for a leaf
 */
export declare function checkAllRequirements(leafName: string, projectPath?: string): RequirementCheckResult[];
/**
 * Get all missing requirements for a leaf
 */
export declare function getMissingRequirements(leafName: string, projectPath?: string): RequirementCheckResult[];
/**
 * Get the installed leaf config from the project
 */
export declare function getInstalledLeafConfig(leafName: string, projectPath?: string): LeafConfig | null;
/**
 * Get all installed leafs in the project
 */
export declare function getInstalledLeafs(projectPath?: string): string[];
export interface LeafUpdateInfo {
    name: string;
    installedVersion: string;
    availableVersion: string;
    hasUpdate: boolean;
}
/**
 * Check if a leaf has an update available
 */
export declare function checkLeafUpdate(leafName: string, projectPath?: string): LeafUpdateInfo | null;
/**
 * Check all installed leafs for updates
 */
export declare function checkAllLeafsUpdates(projectPath?: string): LeafUpdateInfo[];
/**
 * Get only the leafs that have updates available
 */
export declare function getLeafsWithUpdates(projectPath?: string): LeafUpdateInfo[];
