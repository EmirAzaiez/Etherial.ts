var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
export function cmdCommand(commandName) {
    return __awaiter(this, void 0, void 0, function* () {
        const projectPath = process.cwd();
        // Find config file (always dist/Config.js or dist/src/Config.js)
        const configPath = findConfigFile(projectPath);
        if (!configPath) {
            console.log(chalk.red('\n❌ Config file not found.'));
            console.log(chalk.yellow('Make sure you have built your project: npm run build'));
            console.log(chalk.gray('\nLooking for: dist/Config.js or dist/src/Config.js\n'));
            return;
        }
        const spinner = ora('Loading Etherial...').start();
        try {
            // Load etherial
            const etherial = (yield import('etherial')).default;
            // Load project config
            const config = (yield loadConfig(configPath)).default;
            if (config.http) {
                if (config.http.config && config.http.config.port) {
                    config.http.config.logging = false;
                    config.http.config.port = parseInt(config.http.config.port) + 1;
                }
            }
            // Initialize etherial
            etherial.init(config);
            yield etherial.run();
            spinner.succeed('Etherial loaded');
            // Get all commands from modules
            const allModuleCommands = yield etherial.commands();
            const flatCommands = allModuleCommands.flat();
            // If no command specified, list available commands
            if (!commandName) {
                console.log(chalk.cyan('\n📋 Available commands:\n'));
                flatCommands.forEach((cmd) => {
                    const warnIcon = cmd.warn ? chalk.yellow(' ⚠️') : '';
                    console.log(chalk.white(`  ${cmd.command}`) + warnIcon);
                    if (cmd.description) {
                        console.log(chalk.gray(`    ${cmd.description}`));
                    }
                });
                console.log(chalk.yellow(`\nUsage: ${chalk.cyan('etherial cmd <command>')}`));
                console.log(chalk.gray(`Example: etherial cmd database:migrate\n`));
                process.exit(0);
            }
            // Find the command
            const command = flatCommands.find((cmd) => cmd.command === commandName);
            if (!command) {
                console.log(chalk.red(`\n❌ Command "${commandName}" not found.\n`));
                console.log(chalk.yellow('Available commands:'));
                flatCommands.forEach((cmd) => {
                    console.log(chalk.gray(`  - ${cmd.command}`));
                });
                return;
            }
            // If command is dangerous, ask for confirmation
            // @ts-ignore
            if (command.warn) {
                console.log(chalk.yellow('\n⚠️  This command is marked as dangerous.\n'));
                const { confirm } = yield inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'confirm',
                        message: 'Are you sure you want to continue?',
                        default: false,
                    },
                ]);
                if (!confirm) {
                    console.log(chalk.yellow('\n❌ Cancelled\n'));
                    process.exit(0);
                }
            }
            // Execute the command
            console.log(chalk.blue(`\n🚀 Running: ${commandName}\n`));
            const result = yield command.action(etherial);
            if (result !== undefined) {
                console.log(chalk.green('\n✅ Result:'));
                console.log(result);
            }
            console.log(chalk.green('\n✅ Done!\n'));
            process.exit(0);
        }
        catch (error) {
            spinner.fail('Failed to load Etherial');
            console.error(chalk.red(error));
            process.exit(1);
        }
    });
}
/**
 * Find the config file in the project
 */
function findConfigFile(projectPath) {
    const possiblePaths = [
        path.join(projectPath, 'dist', 'Config.js'),
        path.join(projectPath, 'dist', 'src', 'Config.js'),
    ];
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}
/**
 * Load the config file
 */
function loadConfig(configPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const config = yield import(configPath);
        return config.default || config;
    });
}
