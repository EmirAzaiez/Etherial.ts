var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import ora from 'ora';
/**
 * Get the path to the .agent template folder
 */
function getAgentTemplatePath() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // In local development - go from dist/bin/commands to resources/templates/project/.agent
    const localPath = path.resolve(__dirname, '../../../resources/templates/project/.agent');
    if (fs.existsSync(localPath)) {
        return localPath;
    }
    // From node_modules - go to resources/templates/project/.agent
    const cwdNodeModules = path.join(process.cwd(), 'node_modules', 'etherial', 'resources', 'templates', 'project', '.agent');
    if (fs.existsSync(cwdNodeModules)) {
        return cwdNodeModules;
    }
    throw new Error(`Agent template not found at:\n- ${localPath}\n- ${cwdNodeModules}`);
}
/**
 * Recursively copy a directory, overwriting existing files
 */
function copyDirRecursive(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath);
        }
        else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
export function agentUpdateCommand() {
    return __awaiter(this, void 0, void 0, function* () {
        const destPath = path.join(process.cwd(), '.agent');
        console.log(chalk.blue('\n🤖 Updating .agent configuration\n'));
        const spinner = ora('Copying .agent template...').start();
        try {
            const templatePath = getAgentTemplatePath();
            // Remove existing .agent folder if it exists
            if (fs.existsSync(destPath)) {
                fs.rmSync(destPath, { recursive: true });
            }
            // Copy the template
            copyDirRecursive(templatePath, destPath);
            spinner.succeed('.agent configuration updated successfully');
            console.log(chalk.green(`
✅ .agent folder has been updated!

Location: ${chalk.cyan(destPath)}
`));
        }
        catch (error) {
            spinner.fail('Failed to update .agent configuration');
            console.error(chalk.red(error));
        }
    });
}
