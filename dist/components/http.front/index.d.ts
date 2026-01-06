import { IEtherialModule, IEtherial } from '../../index';
export interface HttpFrontConfig {
    viewsFolder?: string;
    defaultLayout?: string;
    viewEngine?: 'ejs' | 'pug' | 'hbs';
    logging?: boolean | ((message: string) => void);
}
export declare class HttpFront implements IEtherialModule {
    private config;
    private log;
    constructor(config?: HttpFrontConfig);
    private setupLogging;
    beforeRun(): Promise<void>;
    run({ http }: IEtherial): Promise<void>;
    afterRun(): Promise<void>;
    commands(): any[];
}
