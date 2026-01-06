import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'
import { isLeafInstalledInProject, removeLeafFromProject } from '../utils/leafs.js'

interface LeafRemoveOptions {
    force: boolean
}

export async function leafRemoveCommand(leafName: string, options: LeafRemoveOptions) {
    console.log(chalk.blue(`\n🗑️  Removing Leaf: ${leafName}\n`))

    // Check if Leaf is installed
    if (!isLeafInstalledInProject(leafName)) {
        console.log(chalk.red(`❌ Folder src/${leafName} does not exist.\n`))
        return
    }

    // Ask for confirmation
    if (!options.force) {
        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: `Are you sure you want to delete src/${leafName}/?`,
                default: false,
            },
        ])

        if (!confirm) {
            console.log(chalk.yellow('\n❌ Cancelled\n'))
            return
        }
    }

    const spinner = ora(`Removing ${leafName}...`).start()

    const success = removeLeafFromProject(leafName)

    if (success) {
        spinner.succeed(`${leafName} removed!`)
        console.log(chalk.green(`\n✅ Folder src/${leafName}/ deleted.\n`))
    } else {
        spinner.fail('Failed to remove')
    }
}
