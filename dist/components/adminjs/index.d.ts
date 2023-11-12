import { IEtherialModule } from "../../index";
export declare class AdminJS implements IEtherialModule {
    etherial_module_name: string;
    adminRoutePath: string;
    AdminJS: any;
    componentLoader: any;
    constructor({ adminRoutePath }: {
        adminRoutePath: string;
    });
    injectAdminJS(config: any): Promise<void>;
}
