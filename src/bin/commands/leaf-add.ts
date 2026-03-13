import chalk from 'chalk'
import {
    getAvailableLeafs,
    leafExists,
    getLeafConfig,
    LeafConfig
} from '../utils/leafs.js'

export async function leafAddCommand(leafName: string) {
    console.log(chalk.blue(`\n🌿 Leaf: ${leafName}\n`))

    // Check if Leaf exists
    if (!leafExists(leafName)) {
        console.log(chalk.red(`❌ Leaf "${leafName}" not found.\n`))

        const availableLeafs = getAvailableLeafs()
        if (availableLeafs.length > 0) {
            console.log(chalk.yellow('Available Leafs:'))
            availableLeafs.forEach(leaf => {
                console.log(chalk.cyan(`  - ${leaf}`))
            })
        }
        return
    }

    // Get leaf configuration and display setup info
    const leafConfig = getLeafConfig(leafName)

    if (leafConfig) {
        displayPostInstallInfo(leafConfig)
    } else {
        console.log(chalk.green(`\n✅ ${leafName} is available in the etherial package.\n`))
        console.log(chalk.cyan(`  Import it from 'etherial' and add it to your config.\n`))
    }
}

function displayPostInstallInfo(config: LeafConfig) {
    const boxWidth = 70
    const line = '─'.repeat(boxWidth)
    const doubleLine = '═'.repeat(boxWidth)

    console.log(chalk.green(doubleLine))
    console.log(chalk.green.bold(`  🌿 ${config.name} v${config.version}`))
    console.log(chalk.green(doubleLine))
    console.log()

    // Description
    if (config.description) {
        console.log(chalk.white(`  ${config.description}`))
        console.log()
    }

    // Environment variables
    if (config.env && config.env.length > 0) {
        console.log(chalk.yellow.bold('  📋 Environment Variables (.env)'))
        console.log(chalk.gray(`  ${line}`))
        console.log()

        const requiredEnv = config.env.filter(e => e.required)
        const optionalEnv = config.env.filter(e => !e.required)

        if (requiredEnv.length > 0) {
            console.log(chalk.red('  Required:'))
            requiredEnv.forEach(env => {
                console.log(chalk.cyan(`    ${env.key}=`) + chalk.gray(env.example))
                console.log(chalk.gray(`      # ${env.description}`))
            })
            console.log()
        }

        if (optionalEnv.length > 0) {
            console.log(chalk.gray('  Optional:'))
            optionalEnv.forEach(env => {
                console.log(chalk.cyan(`    ${env.key}=`) + chalk.gray(env.example || env.default || ''))
                console.log(chalk.gray(`      # ${env.description}${env.default ? ` (default: ${env.default})` : ''}`))
            })
            console.log()
        }
    }

    // Config setup
    if (config.config) {
        console.log(chalk.yellow.bold('  ⚙️  Configuration (Config.ts)'))
        console.log(chalk.gray(`  ${line}`))
        console.log()
        console.log(chalk.white('  1. Add import:'))
        console.log(chalk.cyan(`     ${config.config.import}`))
        console.log()
        console.log(chalk.white('  2. Add to your config object:'))
        console.log()
        console.log(formatConfigExample(config.config.example))
        console.log()
    }

    // NPM dependencies
    if (config.npm_dependencies && Object.keys(config.npm_dependencies).length > 0) {
        console.log(chalk.yellow.bold('  📦 NPM Dependencies'))
        console.log(chalk.gray(`  ${line}`))
        console.log()
        console.log(chalk.white('  Run:'))
        const deps = Object.entries(config.npm_dependencies)
            .map(([name, version]) => `${name}@${version}`)
            .join(' ')
        console.log(chalk.cyan(`    npm install ${deps}`))
        console.log(chalk.gray('  or'))
        console.log(chalk.cyan(`    yarn add ${deps}`))
        console.log()
    }

    // Dependencies on other leafs
    if (config.dependencies && config.dependencies.length > 0) {
        console.log(chalk.yellow.bold('  🔗 Leaf Dependencies'))
        console.log(chalk.gray(`  ${line}`))
        console.log()
        config.dependencies.forEach(dep => {
            console.log(chalk.cyan(`    - ${dep}`))
        })
        console.log()
    }

    // Available routes
    if (config.routes && Object.keys(config.routes).length > 0) {
        console.log(chalk.yellow.bold('  🛣️  Available Routes'))
        console.log(chalk.gray(`  ${line}`))
        console.log()
        Object.entries(config.routes).forEach(([routeName, routeInfo]) => {
            console.log(chalk.white(`    ${routeName}: `) + chalk.gray(routeInfo.description))
            console.log(chalk.cyan(`      Methods: ${routeInfo.methods.join(', ')}`))
        })
        console.log()
    }

    // Commands
    if (config.commands && config.commands.length > 0) {
        console.log(chalk.yellow.bold('  🔧 Available Commands'))
        console.log(chalk.gray(`  ${line}`))
        console.log()
        config.commands.forEach(cmd => {
            console.log(chalk.white(`    ${cmd.name}: `) + chalk.gray(cmd.description))
        })
        console.log()
    }

    // Models
    if (config.models && config.models.length > 0) {
        console.log(chalk.yellow.bold('  🗄️  Database Models'))
        console.log(chalk.gray(`  ${line}`))
        console.log()
        console.log(chalk.gray(`    ${config.models.join(', ')}`))
        console.log()
    }

    console.log(chalk.green(doubleLine))
    console.log(chalk.gray('  📚 For more info: https://etherial.dev/leafs/' + config.name.toLowerCase()))
    console.log(chalk.green(doubleLine))
    console.log()
}

function formatConfigExample(example: Record<string, unknown>, indent: number = 5): string {
    const spaces = ' '.repeat(indent)
    let result = ''

    function stringify(obj: unknown, level: number): string {
        const currentIndent = ' '.repeat(indent + level * 2)
        const nextIndent = ' '.repeat(indent + (level + 1) * 2)

        if (typeof obj === 'string') {
            // Check if it's a code reference (like process.env.X)
            if (obj.includes('process.env') || obj === 'ETHUserLeaf' || obj === 'ETHDeviceLeaf' || obj === 'ETHMediaLeaf') {
                return chalk.yellow(obj)
            }
            return chalk.green(`'${obj}'`)
        }

        if (typeof obj === 'number' || typeof obj === 'boolean') {
            return chalk.magenta(String(obj))
        }

        if (Array.isArray(obj)) {
            if (obj.length === 0) return '[]'
            if (obj.every(item => typeof item === 'string')) {
                const items = obj.map(item => chalk.green(`'${item}'`)).join(', ')
                return `[${items}]`
            }
            const items = obj.map(item => `${nextIndent}${stringify(item, level + 1)}`).join(',\n')
            return `[\n${items}\n${currentIndent}]`
        }

        if (typeof obj === 'object' && obj !== null) {
            const entries = Object.entries(obj as Record<string, unknown>)
            if (entries.length === 0) return '{}'

            const items = entries.map(([key, value]) => {
                return `${nextIndent}${chalk.white(key)}: ${stringify(value, level + 1)}`
            }).join(',\n')

            return `{\n${items},\n${currentIndent}}`
        }

        return String(obj)
    }

    const entries = Object.entries(example)
    for (const [key, value] of entries) {
        result += `${spaces}${chalk.white(key)}: ${stringify(value, 0)},\n`
    }

    return result
}
