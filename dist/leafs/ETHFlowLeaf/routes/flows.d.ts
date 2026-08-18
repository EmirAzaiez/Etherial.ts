import type { Request, Response } from 'express';
export default class FlowsController {
    /** The palette: every trigger and every step this workspace can offer. */
    getSchema(req: Request & {
        user: any;
    }, res: Response): Promise<any>;
    /**
     * The same, for one entry, with the configuration the user has filled in so
     * far. Field lists and outputs depend on it — the date picker of a scheduled
     * query cannot be built before the collection is chosen.
     */
    resolveSchema(req: Request & {
        user: any;
        body: {
            kind: 'trigger' | 'node';
            type: string;
            config?: Record<string, any>;
        };
    }, res: Response): Promise<any>;
    list(req: Request & {
        user: any;
        query: any;
    }, res: Response): Promise<any>;
    show(req: Request & {
        user: any;
        params: {
            id: string;
        };
    }, res: Response): Promise<any>;
    create(req: Request & {
        user: any;
        body: any;
    }, res: Response): Promise<any>;
    update(req: Request & {
        user: any;
        params: {
            id: string;
        };
        body: any;
    }, res: Response): Promise<any>;
    remove(req: Request & {
        user: any;
        params: {
            id: string;
        };
    }, res: Response): Promise<any>;
    /** Runs it once, now, on a record the user picks. The Test button. */
    run(req: Request & {
        user: any;
        params: {
            id: string;
        };
        body: any;
    }, res: Response): Promise<any>;
    runs(req: Request & {
        user: any;
        params: {
            id: string;
        };
        query: any;
    }, res: Response): Promise<any>;
    showRun(req: Request & {
        user: any;
        params: {
            runId: string;
        };
    }, res: Response): Promise<any>;
    /** Issues a new inbound URL and retires the old one. */
    rotateToken(req: Request & {
        user: any;
        params: {
            id: string;
        };
    }, res: Response): Promise<any>;
    /** Describe the automation in a sentence; get a graph back to edit. */
    generate(req: Request & {
        user: any;
        body: any;
    }, res: Response): Promise<any>;
}
export declare const AvailableRouteMethods: readonly ["getSchema", "resolveSchema", "list", "show", "create", "update", "remove", "run", "runs", "showRun", "rotateToken", "generate"];
