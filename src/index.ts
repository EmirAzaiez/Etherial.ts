import 'reflect-metadata'

import { Http } from './components/http'
import { HttpAuth } from './components/http.auth'
import { HttpSecurity } from './components/http.security'

import { Reactive } from './components/reactive'
import { Database } from './components/database'
import { RawSQL } from './components/sql'
import { Translation } from './components/translation'
import { HttpFront } from './components/http.front'

// Type for module configuration
export interface ModuleConfig {
    [key: string]: unknown
}

// Interface for Etherial modules with lifecycle methods
export interface IEtherialModule {
    beforeRun?(etherial: IEtherial): Promise<void> | void
    run?(etherial: IEtherial): Promise<void> | void
    afterRun?(etherial: IEtherial): Promise<void> | void
    commands?(etherial: IEtherial): CommandDefinition[]
}

// Command definition type
export interface CommandDefinition {
    command: string
    description?: string
    action: (...args: unknown[]) => Promise<any> | any
}

export interface IEtherial {
    init(config: EtherialModuleMap): void
    run(): Promise<Etherial>
    commands(): Promise<CommandDefinition[]>
    initDone: boolean
    initInProgress: boolean

    // Components
    database?: Database
    http?: Http
    http_front?: HttpFront
    http_auth?: HttpAuth
    http_security?: HttpSecurity
    reactive?: Reactive
    translation?: Translation
    sql?: RawSQL
}

type ModuleConstructor = new (config: ModuleConfig) => IEtherialModule

type ModuleWithConfig = {
    module: ModuleConstructor
    config: ModuleConfig
}

type EtherialModuleMap = {
    [key: string]: ModuleWithConfig
}

export class Etherial implements IEtherial {
    // Components
    database?: Database
    http?: Http
    http_front?: HttpFront
    http_auth?: HttpAuth
    http_security?: HttpSecurity
    reactive?: Reactive
    translation?: Translation
    sql?: RawSQL

    initDone = false
    initInProgress = false

    // Reserved keys that should not be treated as modules
    private static readonly RESERVED_KEYS = new Set(['initDone', 'initInProgress'])

    /**
     * Get sorted module keys, with 'app' always last
     */
    private getModuleKeys(): string[] {
        return Object.keys(this)
            .filter(key =>
                !Etherial.RESERVED_KEYS.has(key) &&
                typeof this[key] === 'object' &&
                this[key] !== null
            )
            .sort((a, b) => {
                // 'app' always comes last
                if (a === 'app') return 1
                if (b === 'app') return -1
                return a.localeCompare(b)
            })
    }

    /**
     * Initialize Etherial with module configurations
     */
    init(config: EtherialModuleMap): void {
        this.initInProgress = true

        for (const name of Object.keys(config)) {
            if (this[name]) {
                console.warn(`Module "${name}" is already initialized, skipping.`)
                continue
            }

            const component = config[name]

            if (!component.module) {
                throw new Error(`Module "${name}" is not a valid Etherial module. Missing 'module' property.`)
            }

            try {
                const moduleInstance = new component.module(component.config || {})
                this[name] = moduleInstance
            } catch (error) {
                throw new Error(`Failed to initialize module "${name}": ${error.message}`)
            }
        }
    }

    /**
     * Run lifecycle: beforeRun → run → afterRun (in sequence)
     */
    async run(): Promise<Etherial> {
        const moduleKeys = this.getModuleKeys()

        try {
            // Phase 1: beforeRun (all modules in parallel)
            await Promise.all(
                moduleKeys.map(async (key) => {
                    const module = this[key] as IEtherialModule
                    if (module?.beforeRun) {
                        await module.beforeRun(this)
                    }
                })
            )

            // Phase 2: run (all modules in parallel)
            await Promise.all(
                moduleKeys.map(async (key) => {
                    const module = this[key] as IEtherialModule
                    if (module?.run) {
                        await module.run(this)
                    }
                })
            )

            // Mark initialization as complete
            this.initDone = true
            this.initInProgress = false

            // Phase 3: afterRun (all modules in parallel)
            await Promise.all(
                moduleKeys.map(async (key) => {
                    const module = this[key] as IEtherialModule
                    if (module?.afterRun) {
                        await module.afterRun(this)
                    }
                })
            )

            return this
        } catch (error) {
            this.initInProgress = false
            throw new Error(`Etherial run failed: ${error.message}`)
        }
    }

    /**
     * Collect all commands from modules
     */
    async commands(): Promise<CommandDefinition[]> {
        const moduleKeys = this.getModuleKeys()
        const allCommands: CommandDefinition[] = []

        for (const key of moduleKeys) {
            const module = this[key] as IEtherialModule

            if (module?.commands) {
                const moduleCommands = module.commands(this)

                // Prefix each command with the module name
                for (const cmd of moduleCommands) {
                    allCommands.push({
                        ...cmd,
                        command: `${key}:${cmd.command}`,
                    })
                }
            }
        }

        return allCommands
    }
}

Object.freeze(Etherial)

export default new Etherial()
