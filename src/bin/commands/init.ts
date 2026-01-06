import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'

/**
 * Get the path to the templates folder
 */
function getTemplatePath(): string {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)

    // In local development - go from dist/bin/commands to resources/templates
    const localPath = path.resolve(__dirname, '../../../resources/templates/project')
    if (fs.existsSync(localPath)) {
        return localPath
    }

    // From node_modules - go to resources/templates
    const cwdNodeModules = path.join(process.cwd(), 'node_modules', 'etherial', 'resources', 'templates', 'project')
    if (fs.existsSync(cwdNodeModules)) {
        return cwdNodeModules
    }

    throw new Error('Template not found')
}

/**
 * Recursively copy a directory
 */
function copyDirRecursive(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true })

    const entries = fs.readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)

        if (entry.isDirectory()) {
            copyDirRecursive(srcPath, destPath)
        } else {
            fs.copyFileSync(srcPath, destPath)
        }
    }
}

export async function initCommand(projectName: string | undefined) {
    console.log(chalk.blue('\n🚀 Creating a new Etherial project\n'))

    // Ask for project name if not provided
    if (!projectName) {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'projectName',
                message: 'Project name:',
                default: 'my-etherial-app',
                validate: (input: string) => {
                    if (!/^[a-zA-Z0-9-_]+$/.test(input)) {
                        return 'Project name can only contain letters, numbers, dashes and underscores'
                    }
                    return true
                },
            },
        ])
        projectName = answers.projectName
    }

    const projectPath = path.join(process.cwd(), projectName)

    // Check if folder exists
    if (fs.existsSync(projectPath)) {
        const { overwrite } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'overwrite',
                message: `Folder ${projectName} already exists. Overwrite?`,
                default: false,
            },
        ])

        if (!overwrite) {
            console.log(chalk.yellow('\n❌ Cancelled\n'))
            return
        }

        fs.rmSync(projectPath, { recursive: true })
    }

    // Copy template
    const spinner = ora('Copying template...').start()

    try {
        const templatePath = getTemplatePath()
        copyDirRecursive(templatePath, projectPath)

        // Rename dotfiles (env.example -> .env.example, gitignore -> .gitignore)
        const renames = [
            { from: 'env.example', to: '.env.example' },
            { from: 'gitignore', to: '.gitignore' },
        ]
        for (const { from, to } of renames) {
            const srcFile = path.join(projectPath, from)
            const destFile = path.join(projectPath, to)
            if (fs.existsSync(srcFile)) {
                fs.renameSync(srcFile, destFile)
            }
        }

        // Update project name in package.json
        const packageJsonPath = path.join(projectPath, 'package.json')
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        packageJson.name = projectName
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))

        // Update README
        const readmePath = path.join(projectPath, 'README.md')
        if (fs.existsSync(readmePath)) {
            let readme = fs.readFileSync(readmePath, 'utf-8')
            readme = readme.replace('# My Etherial App', `# ${projectName}`)
            fs.writeFileSync(readmePath, readme)
        }

        spinner.succeed('Template copied')

        // Install dependencies
        const { install } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'install',
                message: 'Install dependencies now?',
                default: true,
            },
        ])

        if (install) {
            const depSpinner = ora('Installing dependencies...').start()
            try {
                execSync('npm install', { cwd: projectPath, stdio: 'pipe' })
                depSpinner.succeed('Dependencies installed')
            } catch {
                depSpinner.fail('Failed to install dependencies')
                console.log(chalk.yellow('Run manually: npm install'))
            }
        }

        // Success message
        console.log(chalk.green(`
✅ Project ${projectName} created!

To get started:
  ${chalk.cyan(`cd ${projectName}`)}
  ${chalk.cyan('npm run dev')}

To add Leafs:
  ${chalk.cyan('etherial leaf:list')}
  ${chalk.cyan('etherial leaf:add ETHUserLeaf')}

To run commands:
  ${chalk.cyan('etherial cmd')}
`))
    } catch (error) {
        spinner.fail('Failed to create project')
        console.error(chalk.red(error))
    }
}
