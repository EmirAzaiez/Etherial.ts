export default class Translation {
    defaultLanguage?: String;
    internalizations?: {};
    constructor({ defaultLanguage, translations }: {
        defaultLanguage: any;
        translations: any;
    });
    error(error: any, lang: any): any;
    string(key: any, argumentss: any, lang: any): any;
    run({ http }: {
        http?: any;
    }): void;
}
