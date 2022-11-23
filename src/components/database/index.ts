import { Sequelize } from "sequelize-typescript";

export class Database {

    sequelize: Sequelize
    // add ifnore sync
    constructor({server, port, name, username, password, dialect, models}) {

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
                underscored: true
            }
        });


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

        return {

            'database:destroy': {
                arguments: {},
                callback: (args) => {
                    this.sequelize.sync({force: true})
                }
            },

            'database:load:fixtures':  {
                
                arguments: {
                    '--path': [String]
                },

                callback: (args) => {}

            }

        }
        
    }

}