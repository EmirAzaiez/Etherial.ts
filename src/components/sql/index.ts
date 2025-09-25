import { Sequelize } from 'sequelize-typescript'
import * as sequelizeFixtures from 'sequelize-fixtures'
import { IEtherialModule } from '../../index'

import knex, { Knex } from 'knex'

export class SQL implements IEtherialModule {
    etherial_module_name: string = 'sql'

    knex: Knex
    // add ignore sync
    constructor({ server, port, name, username, password, dialect }) {
        if (!server || !port || !name || !username || !password || !dialect) {
            throw new Error('SQL config is not valid.')
        }

        this.knex = knex({
            client: dialect,
            connection: {
                host: server,
                port: port,
                user: username,
                password: password,
                database: name,
            },
        })

        return this
    }

    commands() {
        return []
    }
}

export interface SQLConfig {
    server: string
    port: number
    name: string
    username: string
    password: string
    dialect: string
}
