import { IEtherialModule } from '../../index';
export declare class HttpFront implements IEtherialModule {
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
export interface HttpFrontConfig {
    viewsFolder: string;
    defaultLayout: string;
}
