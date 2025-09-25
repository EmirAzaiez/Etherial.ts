import { Sequelize } from 'sequelize-typescript'
import * as sequelizeFixtures from 'sequelize-fixtures'
import { IEtherialModule } from '../../index'

export class Database implements IEtherialModule {
    etherial_module_name: string = 'database'

    sequelize: Sequelize
    // add ignore sync
    constructor({ server, port, name, username, password, dialect, models }) {
        if (!server || !port || !name || !username || !password || !dialect) {
            throw new Error('Database config is not valid.')
        }

        this.sequelize = new Sequelize({
            host: server,
            port: port,
            database: name,
            dialect: dialect,
            username: username,
            password: password,
            storage: ':memory:',
            logging: false,
            define: {
                underscored: true,
            },
        })

        if (models) {
            this.addModels(models)
        }

        return this
    }

    async run() {
        await this.sequelize.sync()
    }

    addModels(models) {
        this.sequelize.addModels(models)
        return this
    }

    sync() {
        this.sequelize.sync()
    }

    commands() {
        return [
            {
                command: 'destroy',
                description: 'Destroy database for recreate it properly.',
                warn: true,
                action: async () => {
                    try {
                        await this.sequelize.sync({ force: true })
                        return { success: true, message: 'Database destroyed successfully.' }
                    } catch (error) {
                        return { success: false, message: error.message }
                    }
                },
            },
            {
                command: 'load:fixtures <env>',
                description: 'Load fixtures in database (This will destroy the database also).',
                warn: false,
                action: async (etherial, env) => {
                    try {
                        await this.sequelize.sync({ force: true })
                        await sequelizeFixtures.loadFile(`${process.cwd()}/fixtures/${env}.json`, this.sequelize.models)
                        return { success: true, message: 'Fixtures loaded successfully.' }
                    } catch (error) {
                        return { success: false, message: error.message }
                    }
                },
            },
        ]
    }
}

export interface DatabaseConfig {
    server: string
    port: number
    name: string
    username: string
    password: string
    dialect: string
    models: any[]
}
