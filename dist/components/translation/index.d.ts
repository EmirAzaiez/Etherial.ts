export default class Translation {
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
