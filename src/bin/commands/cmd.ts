import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import inquirer from 'inquirer'

export async function cmdCommand(commandName: string | undefined) {
    const projectPath = process.cwd()

    // Find config file (always dist/Config.js or dist/src/Config.js)
    const configPath = findConfigFile(projectPath)

    if (!configPath) {
        console.log(chalk.red('\n❌ Config file not found.'))
        console.log(chalk.yellow('Make sure you have built your project: npm run build'))
        console.log(chalk.gray('\nLooking for: dist/Config.js or dist/src/Config.js\n'))
        return
    }

    const spinner = ora('Loading Etherial...').start()

    try {
        // Load etherial
        const etherial = (await import('etherial')).default

        // Load project config
        const config = await loadConfig(configPath)

        // Initialize etherial
        etherial.init(config)
        await etherial.run()

        spinner.succeed('Etherial loaded')

        // Get all commands from modules
        const allModuleCommands = await etherial.commands()
        const flatCommands = allModuleCommands.flat()

        // If no command specified, list available commands
        if (!commandName) {
            console.log(chalk.cyan('\n📋 Available commands:\n'))

            flatCommands.forEach((cmd: any) => {
                const warnIcon = cmd.warn ? chalk.yellow(' ⚠️') : ''
                console.log(chalk.white(`  ${cmd.command}`) + warnIcon)
                if (cmd.description) {
                    console.log(chalk.gray(`    ${cmd.description}`))
                }
            })

            console.log(chalk.yellow(`\nUsage: ${chalk.cyan('etherial cmd <command>')}`))
            console.log(chalk.gray(`Example: etherial cmd database:migrate\n`))
            return
        }

        // Find the command
        const command = flatCommands.find((cmd: any) => cmd.command === commandName)

        if (!command) {
            console.log(chalk.red(`\n❌ Command "${commandName}" not found.\n`))
            console.log(chalk.yellow('Available commands:'))
            flatCommands.forEach((cmd: any) => {
                console.log(chalk.gray(`  - ${cmd.command}`))
            })
            return
        }

        // If command is dangerous, ask for confirmation
        // @ts-ignore
        if (command.warn) {
            console.log(chalk.yellow('\n⚠️  This command is marked as dangerous.\n'))

            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Are you sure you want to continue?',
                    default: false,
                },
            ])

            if (!confirm) {
                console.log(chalk.yellow('\n❌ Cancelled\n'))
                process.exit(0)
            }
        }

        // Execute the command
        console.log(chalk.blue(`\n🚀 Running: ${commandName}\n`))

        const result = await command.action(etherial)

        if (result !== undefined) {
            console.log(chalk.green('\n✅ Result:'))
            console.log(result)
        }

        console.log(chalk.green('\n✅ Done!\n'))
        process.exit(0)

    } catch (error) {
        spinner.fail('Failed to load Etherial')
        console.error(chalk.red(error))
        process.exit(1)
    }
}

/**
 * Find the config file in the project
 */
function findConfigFile(projectPath: string): string | null {
    const possiblePaths = [
        path.join(projectPath, 'dist', 'Config.js'),
        path.join(projectPath, 'dist', 'src', 'Config.js'),
    ]

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p
        }
    }

    return null
}

/**
 * Load the config file
 */
async function loadConfig(configPath: string): Promise<any> {
    const config = await import(configPath)
    return config.default || config
}
