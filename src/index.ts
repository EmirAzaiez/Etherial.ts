import 'reflect-metadata'

import { Http } from './components/http';
import { HttpSecurity } from './components/http.security';

import { Reactive } from './components/reactive';
import { Database } from './components/database';
import Translation from './components/translation';
import HttpFront from './components/http.front';
import { EthLeafS3 } from './leafs/s3';

export interface IEtherial {

    init(config: any): void;
    run(): Promise<any>;
    commands(): Promise<any[]>;
    initDone: boolean;
    initInProgress: boolean;

    //components
    database?: Database;
    http?: Http;
    http_front?: HttpFront
    http_security?: HttpSecurity;
    reactive?: Reactive;
    translation?: Translation;
    
    //leafs
    s3_leaf?: EthLeafS3;
}

export interface IEtherialModule {
    etherial_module_name: string;
}

type ModuleWithConfig<T extends IEtherialModule> = {
    module: T;
    config: any;
    // [key: string]: unknown;
};
  
type EtherialModuleMap<T extends IEtherialModule> = {
    [key: string]: ModuleWithConfig<T>;
};

export class Etherial implements IEtherial {

    //components
    database?: Database;
    http?: Http;
    http_front?: HttpFront
    http_security?: HttpSecurity;
    reactive?: Reactive;
    translation?: Translation;
    
    //leafs
    s3_leaf?: EthLeafS3;

    initDone = false;
    initInProgress = false;

    init(config: EtherialModuleMap<IEtherialModule>) {

        this.initInProgress = true;

        Object.keys(config).forEach((name) => {

            if (!this[name]) {

                let component = config[name]

                if (component.module && component.module) {

                    //@ts-ignore
                    let moduleInstance = new component.module(component.config)
                    
                    if (moduleInstance.etherial_module_name === name) {
                        this[name] = moduleInstance
                    } else {
                        throw new Error(`Module ${name} defined in config should has this name: ${moduleInstance.etherial_module_name}.`)
                    }
 
                } else {
                    throw new Error(`Module ${name} is not a valid Etherial module.`)
                }

            }

        })

    }

    run() {

        let promises = [];

        Object.keys(this).sort((a, b) => {
            return (a === 'app' ? 1 : 0) - (b === 'app' ? 1 : 0) || +(a > b) || -(a < b);
        }).forEach((element) => {
            if (this[element].run) {

                let rtn = this[element].run(this);
            
                if (rtn instanceof Promise) {
                    promises.push(rtn)
                }
            
            }
        });

        return new Promise((resolve) => {

            Promise.all(promises).then(() => {
                this.initDone = true
                this.initInProgress = false;
                resolve(this)
            })

        })

    }

    commands() {

        return new Promise((resolve: (el: any[]) => void) => {

            let promises = [];

            Object.keys(this).sort((a, b) => {
                return (a === 'app' ? 1 : 0) - (b === 'app' ? 1 : 0) || +(a > b) || -(a < b);
            }).forEach((element) => {

                if (this[element].commands) {

                    let rtn = this[element].commands(this);
                    
                    promises.push(rtn.map((single) => {
                        return {
                            ...single,
                            command: `${element}:${single.command}`
                        }
                    }))
                
                }
            });

            resolve(promises)

        })

    }

}

Object.freeze(Etherial);

export default new Etherial()