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
import { getAvailableLeafs, leafExists, copyLeafToProject, getLeafConfig, getMissingDependencies, getInstallOrder, getMissingRequirements } from '../utils/leafs.js';
export function leafAddCommand(leafName, options) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(chalk.blue(`\n🌿 Installing Leaf: ${leafName}\n`));
        // Check if Leaf exists
        if (!leafExists(leafName)) {
            console.log(chalk.red(`❌ Leaf "${leafName}" not found.\n`));
            const availableLeafs = getAvailableLeafs();
            if (availableLeafs.length > 0) {
                console.log(chalk.yellow('Available Leafs:'));
                availableLeafs.forEach(leaf => {
                    console.log(chalk.cyan(`  - ${leaf}`));
                });
            }
            return;
        }
        // Get leaf configuration
        const leafConfig = getLeafConfig(leafName);
        // Check requirements (models, files, etc.)
        if (!options.skipRequirements) {
            const missingRequirements = getMissingRequirements(leafName);
            if (missingRequirements.length > 0) {
                console.log(chalk.red(`❌ Missing requirements for ${leafName}:\n`));
                for (const { requirement } of missingRequirements) {
                    const typeIcon = requirement.type === 'model' ? '🗄️' : requirement.type === 'file' ? '📄' : '📁';
                    console.log(chalk.yellow(`  ${typeIcon} ${requirement.type.toUpperCase()}: ${requirement.name}`));
                    console.log(chalk.gray(`     ${requirement.description}`));
                    if (requirement.hint) {
                        console.log(chalk.cyan(`     💡 ${requirement.hint}`));
                    }
                    console.log();
                }
                const { continueAnyway } = yield inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'continueAnyway',
                        message: 'Continue installation anyway? (may cause errors)',
                        default: false,
                    },
                ]);
                if (!continueAnyway) {
                    console.log(chalk.yellow('\n❌ Installation cancelled. Please satisfy the requirements first.\n'));
                    console.log(chalk.gray('   Use --skip-requirements to force installation.\n'));
                    return;
                }
            }
        }
        // Check dependencies
        if (!options.skipDeps) {
            const missingDeps = getMissingDependencies(leafName);
            if (missingDeps.length > 0) {
                console.log(chalk.yellow(`⚠️  This leaf requires the following dependencies:\n`));
                missingDeps.forEach(dep => {
                    const depConfig = getLeafConfig(dep);
                    console.log(chalk.cyan(`  - ${dep}`) + (depConfig ? chalk.gray(` (v${depConfig.version})`) : ''));
                });
                console.log();
                const { installDeps } = yield inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'installDeps',
                        message: 'Install required dependencies?',
                        default: true,
                    },
                ]);
                if (!installDeps) {
                    console.log(chalk.yellow('\n❌ Cannot install without dependencies. Use --skip-deps to force.\n'));
                    return;
                }
                // Install dependencies first
                const installOrder = getInstallOrder(leafName);
                for (const depName of installOrder) {
                    if (depName !== leafName) {
                        const depResult = copyLeafToProject(depName);
                        if (depResult.success) {
                            console.log(chalk.green(`  ✓ ${depName} installed`));
                        }
                        else {
                            console.log(chalk.red(`  ✗ Failed to install ${depName}: ${depResult.error}`));
                            return;
                        }
                    }
                }
                console.log();
            }
        }
        // Install the main leaf
        const result = copyLeafToProject(leafName);
        if (!result.success) {
            console.log(chalk.red(`❌ Failed to install ${leafName}: ${result.error}`));
            return;
        }
        // Display post-installation info
        if (leafConfig) {
            displayPostInstallInfo(leafConfig);
        }
        else {
            console.log(chalk.green(`\n✅ ${leafName} installed successfully!\n`));
            console.log(chalk.cyan(`  Installed in: src/${leafName}/\n`));
        }
    });
}
function displayPostInstallInfo(config) {
    const boxWidth = 70;
    const line = '─'.repeat(boxWidth);
    const doubleLine = '═'.repeat(boxWidth);
    console.log(chalk.green(doubleLine));
    console.log(chalk.green.bold(`  ✅ ${config.name} v${config.version} installed successfully!`));
    console.log(chalk.green(doubleLine));
    console.log();
    // Description
    if (config.description) {
        console.log(chalk.white(`  ${config.description}`));
        console.log();
    }
    // Environment variables
    if (config.env && config.env.length > 0) {
        console.log(chalk.yellow.bold('  📋 Environment Variables (.env)'));
        console.log(chalk.gray(`  ${line}`));
        console.log();
        const requiredEnv = config.env.filter(e => e.required);
        const optionalEnv = config.env.filter(e => !e.required);
        if (requiredEnv.length > 0) {
            console.log(chalk.red('  Required:'));
            requiredEnv.forEach(env => {
                console.log(chalk.cyan(`    ${env.key}=`) + chalk.gray(env.example));
                console.log(chalk.gray(`      # ${env.description}`));
            });
            console.log();
        }
        if (optionalEnv.length > 0) {
            console.log(chalk.gray('  Optional:'));
            optionalEnv.forEach(env => {
                console.log(chalk.cyan(`    ${env.key}=`) + chalk.gray(env.example || env.default || ''));
                console.log(chalk.gray(`      # ${env.description}${env.default ? ` (default: ${env.default})` : ''}`));
            });
            console.log();
        }
    }
    // Config setup
    if (config.config) {
        console.log(chalk.yellow.bold('  ⚙️  Configuration (Config.ts)'));
        console.log(chalk.gray(`  ${line}`));
        console.log();
        console.log(chalk.white('  1. Add import:'));
        console.log(chalk.cyan(`     ${config.config.import}`));
        console.log();
        console.log(chalk.white('  2. Add to your config object:'));
        console.log();
        console.log(formatConfigExample(config.config.example));
        console.log();
    }
    // NPM dependencies
    if (config.npm_dependencies && Object.keys(config.npm_dependencies).length > 0) {
        console.log(chalk.yellow.bold('  📦 NPM Dependencies'));
        console.log(chalk.gray(`  ${line}`));
        console.log();
        console.log(chalk.white('  Run:'));
        const deps = Object.entries(config.npm_dependencies)
            .map(([name, version]) => `${name}@${version}`)
            .join(' ');
        console.log(chalk.cyan(`    npm install ${deps}`));
        console.log(chalk.gray('  or'));
        console.log(chalk.cyan(`    yarn add ${deps}`));
        console.log();
    }
    // Dependencies on other leafs
    if (config.dependencies && config.dependencies.length > 0) {
        console.log(chalk.yellow.bold('  🔗 Leaf Dependencies'));
        console.log(chalk.gray(`  ${line}`));
        console.log();
        config.dependencies.forEach(dep => {
            console.log(chalk.green(`    ✓ ${dep}`));
        });
        console.log();
    }
    // Available routes
    if (config.routes && Object.keys(config.routes).length > 0) {
        console.log(chalk.yellow.bold('  🛣️  Available Routes'));
        console.log(chalk.gray(`  ${line}`));
        console.log();
        Object.entries(config.routes).forEach(([routeName, routeInfo]) => {
            console.log(chalk.white(`    ${routeName}: `) + chalk.gray(routeInfo.description));
            console.log(chalk.cyan(`      Methods: ${routeInfo.methods.join(', ')}`));
        });
        console.log();
    }
    // Commands
    if (config.commands && config.commands.length > 0) {
        console.log(chalk.yellow.bold('  🔧 Available Commands'));
        console.log(chalk.gray(`  ${line}`));
        console.log();
        config.commands.forEach(cmd => {
            console.log(chalk.white(`    ${cmd.name}: `) + chalk.gray(cmd.description));
        });
        console.log();
    }
    // Models
    if (config.models && config.models.length > 0) {
        console.log(chalk.yellow.bold('  🗄️  Database Models'));
        console.log(chalk.gray(`  ${line}`));
        console.log();
        console.log(chalk.gray(`    ${config.models.join(', ')}`));
        console.log();
    }
    console.log(chalk.green(doubleLine));
    console.log(chalk.gray('  📚 For more info: https://etherial.dev/leafs/' + config.name.toLowerCase()));
    console.log(chalk.green(doubleLine));
    console.log();
}
function formatConfigExample(example, indent = 5) {
    const spaces = ' '.repeat(indent);
    let result = '';
    function stringify(obj, level) {
        const currentIndent = ' '.repeat(indent + level * 2);
        const nextIndent = ' '.repeat(indent + (level + 1) * 2);
        if (typeof obj === 'string') {
            // Check if it's a code reference (like process.env.X)
            if (obj.includes('process.env') || obj === 'ETHUserLeaf' || obj === 'ETHDeviceLeaf' || obj === 'ETHMediaLeaf') {
                return chalk.yellow(obj);
            }
            return chalk.green(`'${obj}'`);
        }
        if (typeof obj === 'number' || typeof obj === 'boolean') {
            return chalk.magenta(String(obj));
        }
        if (Array.isArray(obj)) {
            if (obj.length === 0)
                return '[]';
            if (obj.every(item => typeof item === 'string')) {
                const items = obj.map(item => chalk.green(`'${item}'`)).join(', ');
                return `[${items}]`;
            }
            const items = obj.map(item => `${nextIndent}${stringify(item, level + 1)}`).join(',\n');
            return `[\n${items}\n${currentIndent}]`;
        }
        if (typeof obj === 'object' && obj !== null) {
            const entries = Object.entries(obj);
            if (entries.length === 0)
                return '{}';
            const items = entries.map(([key, value]) => {
                return `${nextIndent}${chalk.white(key)}: ${stringify(value, level + 1)}`;
            }).join(',\n');
            return `{\n${items},\n${currentIndent}}`;
        }
        return String(obj);
    }
    const entries = Object.entries(example);
    for (const [key, value] of entries) {
        result += `${spaces}${chalk.white(key)}: ${stringify(value, 0)},\n`;
    }
    return result;
}
//# sourceMappingURL=leaf-add.js.map