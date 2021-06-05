import { Sequelize } from "sequelize-typescript";

import * as sequelizeFixtures from 'sequelize-fixtures'

export class Database {

    sequelize: Sequelize

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

        this.sequelize.addModels([models])

        this.sync()

        return this
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

                callback: (args) => {
                
                    // this.sequelize.sync({force: true})

                    // fs.readdir(env, (err, files) => {

                    //     sequelizeFixtures.loadFile(process.cwd() + '/resources/fixtures/common/*.json', Etherial.database.models).then(() => {
                    
                    //         if (files != undefined && files.length !=0) {
                    //             sequelizeFixtures.loadFile(env, Etherial.database.models).then(() => {
                    //                 process.exit()
                    //             })
                    //         } else {
                    //             process.exit()
                    //         }
                    
                            
                    //     })
                    
                    // })

                }

            }

        }
        
    }

}