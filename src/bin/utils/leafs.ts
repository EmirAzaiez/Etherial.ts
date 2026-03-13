import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/**
 * Leaf configuration interface
 */
export interface LeafConfig {
    name: string
    version: string
    description: string
    author?: string
    config_key?: string
    dependencies: string[]
    requirements?: LeafRequirement[]
    mandatory_models?: MandatoryModel[]
    npm_dependencies?: Record<string, string>
    env: LeafEnvVar[]
    config: {
        import: string
        example: Record<string, unknown>
    }
    models?: string[]
    routes?: Record<string, {
        description: string
        methods: string[]
    }>
    services?: string[]
    commands?: {
        name: string
        description: string
    }[]
}

export interface MandatoryModel {
    name: string
    base_class: string
    description: string
}

export interface LeafEnvVar {
    key: string
    description: string
    required: boolean
    example: string
    default?: string
}

export interface LeafRequirement {
    type: 'model' | 'file' | 'directory'
    name: string
    path?: string
    description: string
    hint?: string
}

/**
 * Get the path to the etherial leafs folder
 */
export function getEtherialLeafsPath(): string {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)

    // In local development - go from dist/bin/utils to resources/leafs
    const localLeafsPath = path.resolve(__dirname, '../../../resources/leafs')
    if (fs.existsSync(localLeafsPath)) {
        return localLeafsPath
    }

    // From node_modules - go to resources/leafs
    const cwdNodeModules = path.join(process.cwd(), 'node_modules', 'etherial', 'resources', 'leafs')
    if (fs.existsSync(cwdNodeModules)) {
        return cwdNodeModules
    }

    throw new Error('Cannot find etherial leafs folder')
}

/**
 * List all available Leafs
 */
export function getAvailableLeafs(): string[] {
    try {
        const leafsPath = getEtherialLeafsPath()
        const entries = fs.readdirSync(leafsPath, { withFileTypes: true })

        return entries
            .filter(entry => entry.isDirectory() && entry.name.startsWith('ETH'))
            .map(entry => entry.name)
    } catch {
        return []
    }
}

/**
 * Check if a Leaf exists
 */
export function leafExists(leafName: string): boolean {
    try {
        const leafsPath = getEtherialLeafsPath()
        const leafPath = path.join(leafsPath, leafName)
        return fs.existsSync(leafPath)
    } catch {
        return false
    }
}

/**
 * Get leaf configuration from leaf.json
 */
export function getLeafConfig(leafName: string): LeafConfig | null {
    try {
        const leafsPath = getEtherialLeafsPath()
        const configPath = path.join(leafsPath, leafName, 'leaf.json')

        if (!fs.existsSync(configPath)) {
            return null
        }

        const configContent = fs.readFileSync(configPath, 'utf-8')
        return JSON.parse(configContent) as LeafConfig
    } catch {
        return null
    }
}

/**
 * Check if a leaf has a leaf.json configuration
 */
export function hasLeafConfig(leafName: string): boolean {
    try {
        const leafsPath = getEtherialLeafsPath()
        const configPath = path.join(leafsPath, leafName, 'leaf.json')
        return fs.existsSync(configPath)
    } catch {
        return false
    }
}
