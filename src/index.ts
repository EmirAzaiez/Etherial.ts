import * as colors from 'colors'
import arg from 'arg'

colors.setTheme({
    info: 'green',
    warn: 'yellow',
    error: 'red'
});

class Etherial {

    init(config) {

        Object.keys(config).forEach((element) => {

            if (!this[element]) {
                let component = config[element]
                this[element] = new component['module'](component.config)
            }

        })

        return this
        

    }

    run() {

        Object.keys(this).sort((a, b) => {

            return (a === 'app' ? 1 : 0) - (b === 'app' ? 1 : 0) || + (a>b) || - (a<b);
        }).forEach((element) => {

            if (this[element].run) {
                this[element].run(this)
            }
        })

        return this

    }

    commands() {

        let commands = {}
        let command = process.argv[2]

        Object.keys(this).forEach((element) => {

            if (this[element].commands) {

                let cmds = this[element].commands()

                Object.keys(cmds).forEach((cmd) => {
                    commands[cmd] = cmds[cmd]
                })

            }

        })

        if (commands[command]) {
            const args = arg((commands[command].arguments || {}));
            commands[command].callback(args)
        } else {
            console.log(`Command ${command} not found, type --help for more informations.`)
        }
        
    }

}

Object.freeze(Etherial);

export default new Etherial()