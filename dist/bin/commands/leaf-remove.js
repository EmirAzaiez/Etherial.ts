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
import inquirer from 'inquirer';
import ora from 'ora';
import { isLeafInstalledInProject, removeLeafFromProject } from '../utils/leafs.js';
export function leafRemoveCommand(leafName, options) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(chalk.blue(`\n🗑️  Removing Leaf: ${leafName}\n`));
        // Check if Leaf is installed
        if (!isLeafInstalledInProject(leafName)) {
            console.log(chalk.red(`❌ Folder src/${leafName} does not exist.\n`));
            return;
        }
        // Ask for confirmation
        if (!options.force) {
            const { confirm } = yield inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Are you sure you want to delete src/${leafName}/?`,
                    default: false,
                },
            ]);
            if (!confirm) {
                console.log(chalk.yellow('\n❌ Cancelled\n'));
                return;
            }
        }
        const spinner = ora(`Removing ${leafName}...`).start();
        const success = removeLeafFromProject(leafName);
        if (success) {
            spinner.succeed(`${leafName} removed!`);
            console.log(chalk.green(`\n✅ Folder src/${leafName}/ deleted.\n`));
        }
        else {
            spinner.fail('Failed to remove');
        }
    });
}
//# sourceMappingURL=leaf-remove.js.map