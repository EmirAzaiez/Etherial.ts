import type { Request, Response } from 'express';
export default class ETHAnalyticsIngestController {
    /**
     * POST /analytics/events
     *
     * { installation_id, platform, app_version, os_version, device_model, locale,
     *   events: [{ type: 'screen' | 'action' | 'app', name, screen?, properties?, duration_ms?, at? }] }
     *
     * Signed in or not: a valid token names the user, anything else is a guest.
     * Always answers 202 with what it kept, so a phone never retries a batch
     * because one event in it was wrong.
     */
    ingest(req: Request, res: Response): Promise<any>;
}
