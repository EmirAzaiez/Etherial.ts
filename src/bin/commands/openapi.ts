import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import ora from 'ora'
import { createOpenAPIAnalyzer, OpenAPISpec } from '../../components/http/openapi.analyzer.js'

export async function openapiCommand() {
    const projectPath = process.cwd()

    const spinner = ora('Analyzing project...').start()

    try {
        // Check if we have source files
        const srcPath = path.join(projectPath, 'src')
        if (!fs.existsSync(srcPath)) {
            spinner.fail('Source directory not found')
            console.log(chalk.yellow('Make sure you are in a project root with a src/ directory'))
            return
        }

        // Create analyzer
        const analyzer = createOpenAPIAnalyzer()

        // Detect project structure
        const routesPath = detectRoutesPath(projectPath)
        const modelsPath = detectModelsPath(projectPath)
        const formsPath = detectFormsPath(projectPath)

        spinner.text = 'Analyzing routes...'

        // Get project name from package.json if exists
        let projectName = 'Etherial API'
        const packageJsonPath = path.join(projectPath, 'package.json')
        if (fs.existsSync(packageJsonPath)) {
            try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
                projectName = packageJson.name || projectName
            } catch {
                // Ignore parse errors
            }
        }

        // Analyze project
        const spec = await analyzer.analyzeProject(projectPath, {
            routesPaths: routesPath ? [routesPath] : [],
            modelsPaths: modelsPath ? [modelsPath] : [],
            formsPaths: formsPath ? [formsPath] : [],
            projectName,
        })

        // Add some stats
        const routeCount = Object.keys(spec.paths).length
        const schemaCount = Object.keys(spec.components.schemas).length
        const leafCount = detectLeafCount(projectPath)

        spinner.text = 'Writing openapi.json...'

        // Write file
        const outputPath = path.join(projectPath, 'openapi.json')
        fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2))

        spinner.succeed(chalk.green('openapi.json generated successfully!'))

        console.log('')
        console.log(chalk.cyan('📊 Summary:'))
        console.log(chalk.white(`   • Routes: ${routeCount}`))
        console.log(chalk.white(`   • Schemas: ${schemaCount}`))
        if (leafCount > 0) {
            console.log(chalk.white(`   • Leafs: ${leafCount}`))
        }
        console.log('')
        console.log(chalk.gray(`   Output: ${outputPath}`))

    } catch (error) {
        spinner.fail('Failed to generate OpenAPI spec')
        console.error(chalk.red((error as Error).message))
        if (process.env.DEBUG) {
            console.error(error)
        }
    }
}

// ============================================
// Path Detection Helpers
// ============================================

function detectRoutesPath(projectPath: string): string | null {
    const possiblePaths = [
        path.join(projectPath, 'src', 'routes'),
        path.join(projectPath, 'routes'),
        path.join(projectPath, 'src', 'controllers'),
        path.join(projectPath, 'controllers'),
    ]

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p
        }
    }

    return null
}

function detectModelsPath(projectPath: string): string | null {
    const possiblePaths = [
        path.join(projectPath, 'src', 'models'),
        path.join(projectPath, 'models'),
    ]

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p
        }
    }

    return null
}

function detectFormsPath(projectPath: string): string | null {
    const possiblePaths = [
        path.join(projectPath, 'src', 'forms'),
        path.join(projectPath, 'forms'),
        path.join(projectPath, 'src', 'schemas'),
        path.join(projectPath, 'schemas'),
    ]

    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p
        }
    }

    return null
}

function detectLeafCount(projectPath: string): number {
    const srcPath = path.join(projectPath, 'src')
    if (!fs.existsSync(srcPath)) return 0

    try {
        const entries = fs.readdirSync(srcPath, { withFileTypes: true })
        let count = 0

        for (const entry of entries) {
            if (!entry.isDirectory()) continue

            const dirPath = path.join(srcPath, entry.name)
            const hasLeafJson = fs.existsSync(path.join(dirPath, 'leaf.json'))
            const matchesPattern = /^ETH\w+Leaf$/.test(entry.name)

            if (hasLeafJson || matchesPattern) {
                count++
            }
        }

        return count
    } catch {
        return 0
    }
}

// ============================================
// Additional Export for CLI
// ============================================

export const command = {
    name: 'openapi',
    description: 'Generate OpenAPI specification from project routes, models, and forms',
    action: openapiCommand,
}
