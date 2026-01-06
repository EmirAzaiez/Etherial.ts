import * as dotenv from 'dotenv'
import 'reflect-metadata'

import etherial from 'etherial'

if (!etherial.initDone && !etherial.initInProgress) {
    const begin = Date.now()

    dotenv.config()

    let config = require('./Config')

    etherial.init(config.default)

    etherial.run().then(() => {
        console.log(`Server is ready on port ${etherial.http.port} in ${(Date.now() - begin) / 1000 + 's'}`)
    })
}

process.on('unhandledRejection', function (err, promise) {
    console.error('Unhandled rejection (promise: ', promise, ', reason: ', err, ').')
})
