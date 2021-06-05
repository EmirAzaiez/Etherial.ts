export default class HttpFront {
    viewsFolder: String;
    defaultLayout: String;
    constructor({ viewsFolder, defaultLayout }: {
        viewsFolder: any;
        defaultLayout: any;
    });
    run({ http }: {
        http: any;
    }): void;
}
