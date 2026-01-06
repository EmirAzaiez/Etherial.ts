import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
/**
 * Get the path to the etherial leafs folder
 */
export function getEtherialLeafsPath() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // In local development - go from dist/bin/utils to resources/leafs
    const localLeafsPath = path.resolve(__dirname, '../../../resources/leafs');
    if (fs.existsSync(localLeafsPath)) {
        return localLeafsPath;
    }
    // From node_modules - go to resources/leafs
    const cwdNodeModules = path.join(process.cwd(), 'node_modules', 'etherial', 'resources', 'leafs');
    if (fs.existsSync(cwdNodeModules)) {
        return cwdNodeModules;
    }
    throw new Error('Cannot find etherial leafs folder');
}
/**
 * List all available Leafs
 */
export function getAvailableLeafs() {
    try {
        const leafsPath = getEtherialLeafsPath();
        const entries = fs.readdirSync(leafsPath, { withFileTypes: true });
        return entries
            .filter(entry => entry.isDirectory() && entry.name.startsWith('ETH'))
            .map(entry => entry.name);
    }
    catch (_a) {
        return [];
    }
}
/**
 * Check if a Leaf exists
 */
export function leafExists(leafName) {
    try {
        const leafsPath = getEtherialLeafsPath();
        const leafPath = path.join(leafsPath, leafName);
        return fs.existsSync(leafPath);
    }
    catch (_a) {
        return false;
    }
}
/**
 * Recursively copy a directory
 */
export function copyDirRecursive(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        }
        else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
/**
 * Copy a Leaf into the project
 */
export function copyLeafToProject(leafName, projectPath = process.cwd()) {
    try {
        const leafsPath = getEtherialLeafsPath();
        const srcPath = path.join(leafsPath, leafName);
        const destPath = path.join(projectPath, 'src', leafName);
        if (!fs.existsSync(srcPath)) {
            return { success: false, destPath, error: `Leaf "${leafName}" not found` };
        }
        // Remove existing folder if present
        if (fs.existsSync(destPath)) {
            fs.rmSync(destPath, { recursive: true });
        }
        copyDirRecursive(srcPath, destPath);
        return { success: true, destPath };
    }
    catch (error) {
        return {
            success: false,
            destPath: '',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
/**
 * Check if a Leaf is installed in the project
 */
export function isLeafInstalledInProject(leafName, projectPath = process.cwd()) {
    const leafPath = path.join(projectPath, 'src', leafName);
    return fs.existsSync(leafPath);
}
/**
 * Remove a Leaf from the project
 */
export function removeLeafFromProject(leafName, projectPath = process.cwd()) {
    const leafPath = path.join(projectPath, 'src', leafName);
    if (fs.existsSync(leafPath)) {
        fs.rmSync(leafPath, { recursive: true });
        return true;
    }
    return false;
}
/**
 * Get leaf configuration from leaf.json
 */
export function getLeafConfig(leafName) {
    try {
        const leafsPath = getEtherialLeafsPath();
        const configPath = path.join(leafsPath, leafName, 'leaf.json');
        if (!fs.existsSync(configPath)) {
            return null;
        }
        const configContent = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(configContent);
    }
    catch (_a) {
        return null;
    }
}
/**
 * Check if a leaf has a leaf.json configuration
 */
export function hasLeafConfig(leafName) {
    try {
        const leafsPath = getEtherialLeafsPath();
        const configPath = path.join(leafsPath, leafName, 'leaf.json');
        return fs.existsSync(configPath);
    }
    catch (_a) {
        return false;
    }
}
/**
 * Get all missing dependencies for a leaf (recursively)
 */
export function getMissingDependencies(leafName, projectPath = process.cwd()) {
    const config = getLeafConfig(leafName);
    if (!config || !config.dependencies || config.dependencies.length === 0) {
        return [];
    }
    const missing = [];
    for (const dep of config.dependencies) {
        if (!isLeafInstalledInProject(dep, projectPath)) {
            missing.push(dep);
            // Also check dependencies of dependencies
            const subDeps = getMissingDependencies(dep, projectPath);
            for (const subDep of subDeps) {
                if (!missing.includes(subDep)) {
                    missing.push(subDep);
                }
            }
        }
    }
    return missing;
}
/**
 * Get leaves to install in the correct order (dependencies first)
 */
export function getInstallOrder(leafName, projectPath = process.cwd()) {
    const order = [];
    const visited = new Set();
    function visit(name) {
        if (visited.has(name))
            return;
        visited.add(name);
        const config = getLeafConfig(name);
        if (config === null || config === void 0 ? void 0 : config.dependencies) {
            for (const dep of config.dependencies) {
                if (!isLeafInstalledInProject(dep, projectPath)) {
                    visit(dep);
                }
            }
        }
        if (!isLeafInstalledInProject(name, projectPath)) {
            order.push(name);
        }
    }
    visit(leafName);
    return order;
}
/**
 * Check if a specific requirement is satisfied
 */
export function checkRequirement(requirement, projectPath = process.cwd()) {
    let checkPaths = [];
    switch (requirement.type) {
        case 'model':
            // Check in common model locations
            checkPaths = [
                requirement.path || path.join(projectPath, 'src', 'models', `${requirement.name}.ts`),
                path.join(projectPath, 'src', 'models', `${requirement.name}.js`),
                path.join(projectPath, 'src', 'model', `${requirement.name}.ts`),
                path.join(projectPath, 'src', 'model', `${requirement.name}.js`),
                // Also check in any installed leaf's models folder
                ...getInstalledLeafModelPaths(requirement.name, projectPath)
            ];
            break;
        case 'file':
            checkPaths = [
                requirement.path || path.join(projectPath, 'src', requirement.name),
                path.join(projectPath, requirement.name)
            ];
            break;
        case 'directory':
            checkPaths = [
                requirement.path || path.join(projectPath, 'src', requirement.name),
                path.join(projectPath, requirement.name)
            ];
            break;
    }
    for (const checkPath of checkPaths) {
        if (fs.existsSync(checkPath)) {
            return {
                satisfied: true,
                requirement,
                foundPath: checkPath
            };
        }
    }
    return {
        satisfied: false,
        requirement
    };
}
/**
 * Get possible paths where a model might exist in installed leafs
 */
function getInstalledLeafModelPaths(modelName, projectPath) {
    const paths = [];
    const srcPath = path.join(projectPath, 'src');
    if (!fs.existsSync(srcPath))
        return paths;
    try {
        const entries = fs.readdirSync(srcPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && entry.name.startsWith('ETH')) {
                // Check in leaf's models folder
                paths.push(path.join(srcPath, entry.name, 'models', `${modelName}.ts`));
                paths.push(path.join(srcPath, entry.name, 'models', `${modelName}.js`));
            }
        }
    }
    catch (_a) {
        // Ignore errors
    }
    return paths;
}
/**
 * Check all requirements for a leaf
 */
export function checkAllRequirements(leafName, projectPath = process.cwd()) {
    const config = getLeafConfig(leafName);
    if (!config || !config.requirements || config.requirements.length === 0) {
        return [];
    }
    return config.requirements.map(req => checkRequirement(req, projectPath));
}
/**
 * Get all missing requirements for a leaf
 */
export function getMissingRequirements(leafName, projectPath = process.cwd()) {
    return checkAllRequirements(leafName, projectPath).filter(r => !r.satisfied);
}
/**
 * Get the installed leaf config from the project
 */
export function getInstalledLeafConfig(leafName, projectPath = process.cwd()) {
    try {
        const configPath = path.join(projectPath, 'src', leafName, 'leaf.json');
        if (!fs.existsSync(configPath)) {
            return null;
        }
        const configContent = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(configContent);
    }
    catch (_a) {
        return null;
    }
}
/**
 * Get all installed leafs in the project
 */
export function getInstalledLeafs(projectPath = process.cwd()) {
    const srcPath = path.join(projectPath, 'src');
    if (!fs.existsSync(srcPath))
        return [];
    try {
        const entries = fs.readdirSync(srcPath, { withFileTypes: true });
        return entries
            .filter(entry => entry.isDirectory() && entry.name.startsWith('ETH'))
            .filter(entry => {
            // Check if it has a leaf.json to confirm it's a valid leaf
            const leafJsonPath = path.join(srcPath, entry.name, 'leaf.json');
            return fs.existsSync(leafJsonPath);
        })
            .map(entry => entry.name);
    }
    catch (_a) {
        return [];
    }
}
/**
 * Check if a leaf has an update available
 */
export function checkLeafUpdate(leafName, projectPath = process.cwd()) {
    const installedConfig = getInstalledLeafConfig(leafName, projectPath);
    const availableConfig = getLeafConfig(leafName);
    if (!installedConfig || !availableConfig) {
        return null;
    }
    return {
        name: leafName,
        installedVersion: installedConfig.version,
        availableVersion: availableConfig.version,
        hasUpdate: compareVersions(availableConfig.version, installedConfig.version) > 0
    };
}
/**
 * Check all installed leafs for updates
 */
export function checkAllLeafsUpdates(projectPath = process.cwd()) {
    const installedLeafs = getInstalledLeafs(projectPath);
    const updates = [];
    for (const leafName of installedLeafs) {
        const updateInfo = checkLeafUpdate(leafName, projectPath);
        if (updateInfo) {
            updates.push(updateInfo);
        }
    }
    return updates;
}
/**
 * Get only the leafs that have updates available
 */
export function getLeafsWithUpdates(projectPath = process.cwd()) {
    return checkAllLeafsUpdates(projectPath).filter(u => u.hasUpdate);
}
/**
 * Compare two semver versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
function compareVersions(v1, v2) {
    const parts1 = v1.replace(/^v/, '').split('.').map(Number);
    const parts2 = v2.replace(/^v/, '').split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2)
            return 1;
        if (p1 < p2)
            return -1;
    }
    return 0;
}
//# sourceMappingURL=leafs.js.map