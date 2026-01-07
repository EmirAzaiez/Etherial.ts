var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import { getAvailableLeafs, leafExists, copyLeafToProject, isLeafInstalledInProject } from '../utils/leafs.js';
export function leafUpdateCommand(leafName, options) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(chalk.blue('\n🔄 Updating Leafs\n'));
        const projectPath = process.cwd();
        const srcPath = path.join(projectPath, 'src');
        // If a name is specified, only update that one
        let leafsToUpdate = [];
        if (leafName) {
            if (!isLeafInstalledInProject(leafName)) {
                console.log(chalk.red(`❌ Leaf "${leafName}" is not installed in src/.\n`));
                return;
            }
            if (!leafExists(leafName)) {
                console.log(chalk.red(`❌ Leaf "${leafName}" does not exist in the etherial package.\n`));
                return;
            }
            leafsToUpdate = [leafName];
        }
        else {
            // Otherwise, find all installed Leafs
            const availableLeafs = getAvailableLeafs();
            leafsToUpdate = availableLeafs.filter(leaf => isLeafInstalledInProject(leaf));
        }
        if (leafsToUpdate.length === 0) {
            console.log(chalk.yellow('No installed Leafs to update.\n'));
            return;
        }
        // Display Leafs to update
        console.log(chalk.cyan('Leafs to update:'));
        leafsToUpdate.forEach(leaf => {
            console.log(chalk.white(`  • ${leaf}`));
        });
        console.log();
        // Warning
        if (!options.force) {
            console.log(chalk.yellow('⚠️  Warning: Update will overwrite your local changes.\n'));
            const { confirm } = yield inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Update ${leafsToUpdate.length} Leaf(s)?`,
                    default: false,
                },
            ]);
            if (!confirm) {
                console.log(chalk.yellow('\n❌ Cancelled\n'));
                return;
            }
        }
        // Update each Leaf
        for (const leaf of leafsToUpdate) {
            const spinner = ora(`Updating ${leaf}...`).start();
            // Remove old folder
            const leafPath = path.join(srcPath, leaf);
            if (fs.existsSync(leafPath)) {
                fs.rmSync(leafPath, { recursive: true });
            }
            // Copy from node_modules
            const result = copyLeafToProject(leaf, projectPath);
            if (result.success) {
                spinner.succeed(`${leaf} updated!`);
            }
            else {
                spinner.fail(`${leaf}: ${result.error}`);
            }
        }
        console.log(chalk.green('\n✅ Update complete!\n'));
    });
}
