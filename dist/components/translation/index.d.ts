import { IEtherialModule } from '../../index';
export declare class Translation implements IEtherialModule {
    etherial_module_name: string;
    defaultLanguage?: String;
    internalizations?: {};
    constructor({ defaultLanguage, translations }: {
        defaultLanguage: any;
        translations: any;
    });
    error(error: any, lang: any): any;
    run({ http }: {
        http?: any;
    }): void;
}
export interface TranslationConfig {
    defaultLanguage: string;
    translations: string[];
}
