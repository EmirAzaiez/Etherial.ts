#!/usr/bin/env node

import { Command } from 'commander'
import chalk from 'chalk'
import { initCommand } from './commands/init.js'
import { leafAddCommand } from './commands/leaf-add.js'
import { leafListCommand } from './commands/leaf-list.js'
import { cmdCommand } from './commands/cmd.js'
import { openapiCommand } from './commands/openapi.js'
import { agentUpdateCommand } from './commands/agent-update.js'
import { verifyCommand } from './commands/verify.js'

const program = new Command()

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
`))

program
    .name('etherial')
    .description('CLI for the Etherial.ts framework')
    .version('0.0.7')

// Command: etherial init
program
    .command('init [project-name]')
    .description('Create a new Etherial project')
    .action(initCommand)

// Command: etherial leaf:add
program
    .command('leaf:add <leaf-name>')
    .description('Show setup info for a Leaf (e.g. ETHUserLeaf)')
    .action(leafAddCommand)

// Command: etherial leaf:list
program
    .command('leaf:list')
    .description('List available Leafs')
    .action(leafListCommand)

// Command: etherial cmd
program
    .command('cmd [command]')
    .description('Run an Etherial module command (e.g. database:migrate)')
    .action(cmdCommand)

// Command: etherial openapi
program
    .command('openapi')
    .description('Generate OpenAPI specification for the project')
    .action(openapiCommand)

// Command: etherial verify
program
    .command('verify')
    .description('Verify that all configured Leafs have their mandatory models and config keys')
    .action(verifyCommand)

// Command: etherial agent:update
program
    .command('agent:update')
    .description('Update .agent configuration from Etherial template (overwrites current .agent folder)')
    .action(agentUpdateCommand)

program.parse()
