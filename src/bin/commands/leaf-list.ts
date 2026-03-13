import chalk from 'chalk'
import { getAvailableLeafs, getLeafConfig } from '../utils/leafs.js'

export async function leafListCommand() {
    console.log(chalk.blue('\n🌿 Etherial Leafs\n'))

    const availableLeafs = getAvailableLeafs()

    if (availableLeafs.length === 0) {
        console.log(chalk.yellow('No Leafs available.\n'))
        return
    }

    console.log(chalk.cyan.bold('📦 Available Leafs:\n'))

    availableLeafs.forEach(leaf => {
        const config = getLeafConfig(leaf)

        console.log(chalk.white.bold(`  ${leaf}`))

        if (config) {
            console.log(chalk.gray(`    v${config.version} - ${config.description}`))

            // Show leaf dependencies
            if (config.dependencies && config.dependencies.length > 0) {
                console.log(chalk.yellow(`    └─ leafs: ${config.dependencies.join(', ')}`))
            }

            // Show npm dependencies
            if (config.npm_dependencies && Object.keys(config.npm_dependencies).length > 0) {
                const npmDeps = Object.keys(config.npm_dependencies).join(', ')
                console.log(chalk.magenta(`    └─ npm: ${npmDeps}`))
            }
        }
        console.log()
    })

    console.log(chalk.gray('─'.repeat(60)))
    console.log(chalk.yellow(`\nTo see setup info: ${chalk.cyan('etherial leaf:add <LeafName>')}`))
    console.log(chalk.gray(`Example: etherial leaf:add ETHUserLeaf\n`))
}
