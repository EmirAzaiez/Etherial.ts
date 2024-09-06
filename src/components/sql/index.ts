import { Sequelize } from 'sequelize-typescript'
import * as sequelizeFixtures from 'sequelize-fixtures'
import { IEtherialModule } from '../../index'

import knex, { Knex } from 'knex'

export class Database implements IEtherialModule {
    etherial_module_name: string = 'sql'

    knex: Knex
    // add ignore sync
    constructor({ server, port, name, username, password, dialect }) {
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

    async run() {
        // await this.sequelize.sync()
    }

    commands() {
        return []
    }
}
