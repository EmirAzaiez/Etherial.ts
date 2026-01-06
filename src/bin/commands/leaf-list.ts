import chalk from 'chalk'
import { getAvailableLeafs, isLeafInstalledInProject, getLeafConfig } from '../utils/leafs.js'

export async function leafListCommand() {
    console.log(chalk.blue('\n🌿 Etherial Leafs\n'))

    const availableLeafs = getAvailableLeafs()

    if (availableLeafs.length === 0) {
        console.log(chalk.yellow('No Leafs available.\n'))
        return
    }

    console.log(chalk.cyan.bold('📦 Available Leafs:\n'))

    availableLeafs.forEach(leaf => {
        const isInstalled = isLeafInstalledInProject(leaf)
        const config = getLeafConfig(leaf)
        const status = isInstalled ? chalk.green(' ✓ installed') : chalk.gray(' ○ not installed')

        console.log(chalk.white.bold(`  ${leaf}`) + status)

        if (config) {
            console.log(chalk.gray(`    v${config.version} - ${config.description}`))

            // Show leaf dependencies
            if (config.dependencies && config.dependencies.length > 0) {
                console.log(chalk.yellow(`    └─ leafs: ${config.dependencies.join(', ')}`))
            }

            // Show requirements (models, files, etc.)
            if (config.requirements && config.requirements.length > 0) {
                const reqSummary = config.requirements.map(r => `${r.type}:${r.name}`).join(', ')
                console.log(chalk.magenta(`    └─ requires: ${reqSummary}`))
            }
        }
        console.log()
    })

    console.log(chalk.gray('─'.repeat(60)))
    console.log(chalk.yellow(`\nTo install: ${chalk.cyan('etherial leaf:add <LeafName>')}`))
    console.log(chalk.gray(`Example: etherial leaf:add ETHUserLeaf\n`))
}
