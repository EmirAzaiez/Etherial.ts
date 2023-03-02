export default class HttpFront {
    viewsFolder: string;
    defaultLayout: string;
    viewEngine: string;
    constructor({ viewsFolder, defaultLayout }: {
        viewsFolder?: string;
        defaultLayout?: string;
    });
    run({ http }: {
        http: any;
    }): void;
}
