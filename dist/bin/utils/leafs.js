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
