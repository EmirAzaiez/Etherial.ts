import { IEtherialModule } from "../../index";
export default class HttpFront implements IEtherialModule {
    etherial_module_name: string;
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
