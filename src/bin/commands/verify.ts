import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { getAvailableLeafs, getLeafConfig, LeafConfig, MandatoryModel } from '../utils/leafs.js'

interface VerifyResult {
    leaf: string
    configKey: string
    configFound: boolean
    models: {
        name: string
        baseClass: string
        description: string
        found: boolean
        foundPath?: string
    }[]
}

export async function verifyCommand() {
    const projectPath = process.cwd()
    const srcPath = path.join(projectPath, 'src')

    console.log(chalk.blue('\n🔍 Etherial Verify\n'))

    if (!fs.existsSync(srcPath)) {
        console.log(chalk.red('❌ No src/ folder found. Are you in an Etherial project?\n'))
        return
    }

    // Get all available leafs with config
    const availableLeafs = getAvailableLeafs()
    const leafConfigs: { name: string; config: LeafConfig }[] = []

    for (const leafName of availableLeafs) {
        const config = getLeafConfig(leafName)
        if (config && config.config_key) {
            leafConfigs.push({ name: leafName, config })
        }
    }

    if (leafConfigs.length === 0) {
        console.log(chalk.yellow('No Leafs with verification data found.\n'))
        return
    }

    // Read all .ts files content from src/ for scanning
    const tsFiles = collectTsFiles(srcPath)
    const fileContents = new Map<string, string>()
    for (const filePath of tsFiles) {
        try {
            fileContents.set(filePath, fs.readFileSync(filePath, 'utf-8'))
        } catch {
            // Skip unreadable files
        }
    }

    // Check each leaf
    const results: VerifyResult[] = []

    for (const { name, config } of leafConfigs) {
        const configKey = config.config_key!
        const configFound = isConfigKeyUsed(configKey, fileContents)

        // Only verify models if the leaf is configured
        const models: VerifyResult['models'] = []

        if (config.mandatory_models && config.mandatory_models.length > 0) {
            for (const model of config.mandatory_models) {
                const found = findModelInProject(model, fileContents)
                models.push({
                    name: model.name,
                    baseClass: model.base_class,
                    description: model.description,
                    found: found.exists,
                    foundPath: found.path,
                })
            }
        }

        results.push({
            leaf: name,
            configKey,
            configFound,
            models,
        })
    }

    // Display results
    const line = '─'.repeat(60)
    let totalIssues = 0

    for (const result of results) {
        const hasIssues = result.configFound && result.models.some(m => !m.found)
        const notConfigured = !result.configFound

        // Header
        if (notConfigured) {
            console.log(chalk.gray(`  ○ ${result.leaf}`) + chalk.gray(` (not configured)`))
            console.log()
            continue
        }

        console.log(chalk.white.bold(`  🌿 ${result.leaf}`))

        // Config key
        console.log(chalk.green(`     ✓ Config key "${result.configKey}" found`))

        // Models
        if (result.models.length > 0) {
            for (const model of result.models) {
                if (model.found) {
                    const relPath = model.foundPath ? path.relative(projectPath, model.foundPath) : ''
                    console.log(chalk.green(`     ✓ ${model.name}`) + chalk.gray(` (${relPath})`))
                } else {
                    totalIssues++
                    console.log(chalk.red(`     ✗ ${model.name} — missing`))
                    console.log(chalk.gray(`       ${model.description}`))
                    console.log(chalk.yellow(`       Create a model that extends ${chalk.cyan(model.baseClass)} from the leaf`))
                }
            }
        }

        console.log()
    }

    // Summary
    console.log(chalk.gray(line))
    if (totalIssues === 0) {
        console.log(chalk.green.bold('\n  ✅ All configured Leafs are properly set up!\n'))
    } else {
        console.log(chalk.red.bold(`\n  ⚠️  ${totalIssues} issue${totalIssues > 1 ? 's' : ''} found\n`))
        console.log(chalk.gray('  Mandatory models must be created in your project.'))
        console.log(chalk.gray('  They extend the base class from the Leaf and register with Sequelize.\n'))
        console.log(chalk.gray('  Example:'))
        console.log(chalk.cyan('    import { BaseDevice } from \'etherial/leafs/ETHPulseLeaf\''))
        console.log(chalk.cyan('    @Table({ tableName: \'devices\' })'))
        console.log(chalk.cyan('    export class Device extends BaseDevice { ... }\n'))
    }
}

/**
 * Recursively collect all .ts files in a directory
 */
function collectTsFiles(dirPath: string): string[] {
    const files: string[] = []

    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true })
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name)
            if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
                files.push(...collectTsFiles(fullPath))
            } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
                files.push(fullPath)
            }
        }
    } catch {
        // Skip unreadable directories
    }

    return files
}

/**
 * Check if a config key is used anywhere in the project source files
 */
function isConfigKeyUsed(configKey: string, fileContents: Map<string, string>): boolean {
    for (const [, content] of fileContents) {
        // Look for the config key in object literals: eth_pulse_leaf: or eth_pulse_leaf =
        if (content.includes(configKey)) {
            return true
        }
    }
    return false
}

/**
 * Find a model in the project by checking if any file imports/extends the base class
 */
function findModelInProject(
    model: MandatoryModel,
    fileContents: Map<string, string>
): { exists: boolean; path?: string } {
    for (const [filePath, content] of fileContents) {
        // Skip files inside the leaf itself or the CLI (we want the user's model, not the base)
        if (filePath.includes('/leafs/ETH') || filePath.includes('/bin/')) {
            continue
        }

        // Check if file extends the base class or imports it
        // Patterns: "extends BaseDevice", "extends BaseMedia", etc.
        if (content.includes(`extends ${model.base_class}`)) {
            return { exists: true, path: filePath }
        }
    }

    return { exists: false }
}
