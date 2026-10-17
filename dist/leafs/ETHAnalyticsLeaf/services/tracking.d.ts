import type { Request, Response, NextFunction } from 'express';
import { Collector } from './collector.js';
import { AnalyticsContext, ETHAnalyticsLeafConfig, TrackApiConfig } from './options.js';
/** `/tickets/:id(\\d+)` → `/tickets/:id`: the pattern is how the route matches, not what it is. */
export declare function cleanRoute(path: string): string;
/** What the app says about itself in its request headers, when it does. */
export declare function contextFromHeaders(req: Request): AnalyticsContext;
/** `identify()` answers, kept a few minutes per user so it is not asked on every call. */
export declare class IdentifyCache {
    private identify?;
    private cache;
    constructor(identify?: ETHAnalyticsLeafConfig['identify']);
    get(userId: number, user: any, req: Request): Promise<AnalyticsContext | null>;
}
export declare function apiTrackingMiddleware(options: TrackApiConfig, config: ETHAnalyticsLeafConfig, collector: Collector, identity: IdentifyCache, skipPrefixes: string[]): (req: Request, res: Response, next: NextFunction) => void;
