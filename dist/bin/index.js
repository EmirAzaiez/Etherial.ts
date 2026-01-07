#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { leafAddCommand } from './commands/leaf-add.js';
import { leafUpdateCommand } from './commands/leaf-update.js';
import { leafListCommand } from './commands/leaf-list.js';
import { leafRemoveCommand } from './commands/leaf-remove.js';
import { cmdCommand } from './commands/cmd.js';
import { getLeafsWithUpdates } from './utils/leafs.js';
const program = new Command();
console.log(chalk.cyan(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   ███████╗████████╗██╗  ██╗███████╗██████╗ ██╗ █████╗ ██╗      ║
║   ██╔════╝╚══██╔══╝██║  ██║██╔════╝██╔══██╗██║██╔══██╗██║      ║
║   █████╗     ██║   ███████║█████╗  ██████╔╝██║███████║██║      ║
║   ██╔══╝     ██║   ██╔══██║██╔══╝  ██╔══██╗██║██╔══██║██║      ║ 
║   ███████╗   ██║   ██║  ██║███████╗██║  ██║██║██║  ██║███████╗ ║
║   ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚══════╝ ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`));
// Check for leaf updates in current project
checkForLeafUpdates();
function checkForLeafUpdates() {
    try {
        const updates = getLeafsWithUpdates();
        if (updates.length > 0) {
            console.log(chalk.yellow.bold('⚠️  Leaf updates available:'));
            console.log(chalk.gray('─'.repeat(50)));
            for (const update of updates) {
                console.log(chalk.white(`  ${update.name}: `) +
                    chalk.red(`v${update.installedVersion}`) +
                    chalk.gray(' → ') +
                    chalk.green(`v${update.availableVersion}`));
            }
            console.log(chalk.gray('─'.repeat(50)));
            console.log(chalk.cyan(`  Run ${chalk.white('etherial leaf:update')} to update all leafs`));
            console.log(chalk.cyan(`  Or  ${chalk.white('etherial leaf:update <LeafName>')} for a specific leaf`));
            console.log();
        }
    }
    catch (_a) {
        // Silently ignore errors (e.g., not in an Etherial project)
    }
}
program
    .name('etherial')
    .description('CLI for the Etherial.ts framework')
    .version('0.0.7');
// Command: etherial init
program
    .command('init [project-name]')
    .description('Create a new Etherial project')
    .action(initCommand);
// Command: etherial leaf:add
program
    .command('leaf:add <leaf-name>')
    .description('Install a Leaf into the project (e.g. ETHUserLeaf)')
    .option('-f, --force', 'Overwrite if Leaf already exists', false)
    .option('--skip-deps', 'Skip dependency installation', false)
    .option('--skip-requirements', 'Skip requirements check (models, files)', false)
    .action(leafAddCommand);
// Command: etherial leaf:update
program
    .command('leaf:update [leaf-name]')
    .description('Update a Leaf (or all if no name specified)')
    .option('-f, --force', 'Update without confirmation', false)
    .action(leafUpdateCommand);
// Command: etherial leaf:list
program
    .command('leaf:list')
    .description('List available Leafs')
    .action(leafListCommand);
// Command: etherial leaf:remove
program
    .command('leaf:remove <leaf-name>')
    .description('Remove a Leaf from the project')
    .option('-f, --force', 'Remove without confirmation', false)
    .action(leafRemoveCommand);
// Command: etherial cmd
program
    .command('cmd [command]')
    .description('Run an Etherial module command (e.g. database:migrate)')
    .action(cmdCommand);
program.parse();
