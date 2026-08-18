// ──────────────────────────────────────────────────────────────────────────
// The inbound URL.
//
// Public by design: the callers are payment providers, form builders and
// Zapier-shaped things that cannot hold a session. The flow's token in the path
// is the credential, and an optional shared secret is checked on top of it for
// anything that costs money.
//
// The call is answered before the automation finishes. A provider that retries
// on a slow response would otherwise fire the flow twice for one event, and the
// caller has nothing to do with the result anyway — the run log is in the
// back-office.
// ──────────────────────────────────────────────────────────────────────────

import { timingSafeEqual } from 'crypto'
import type { Request, Response } from 'express'
import { Controller, Get, Post } from 'etherial/components/http/provider'

import { Flow } from '../models/Flow.js'
import { runFlow } from '../engine/fire.js'
import { WEBHOOK_PREFIX } from '../config.js'

/** Constant-time, and false on any length mismatch rather than throwing. */
function secretMatches(expected: string, received: string | undefined): boolean {
    if (!received) return false
    const a = Buffer.from(String(expected))
    const b = Buffer.from(String(received))
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
}

async function handle(req: any, res: any): Promise<any> {
    const token = String(req.params?.token ?? '')
    if (token.length < 16) return res.error?.({ status: 404, errors: ['not_found'] })

    const flow = await Flow.findOne({ where: { webhook_token: token, deleted_at: null as any } })

    // A disabled flow answers exactly like a missing one: whoever is holding a
    // retired token learns nothing about whether it ever existed.
    if (!flow || !flow.enabled) return res.error?.({ status: 404, errors: ['not_found'] })

    const secret = flow.trigger_config?.secret
    if (secret && !secretMatches(secret, req.headers?.['x-flow-secret'])) {
        return res.error?.({ status: 401, errors: ['invalid_secret'] })
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {}

    const payload = {
        body,
        query: req.query ?? {},
        headers: safeHeaders(req.headers ?? {}),
        method: req.method,
        ip: req.ip ?? null,
    }

    // Answer now, run after. Nothing downstream needs the caller's connection.
    res.success?.({ status: 202, data: { received: true } })

    runFlow(flow, {
        triggerId: flow.trigger_id,
        // The body *is* the record, so `{{record.email}}` works the way it does
        // under every other trigger.
        record: body,
        payload,
        actor: { type: 'guest' },
    }).catch((error) => {
        console.error(`[ETHFlowLeaf] Webhook flow "${flow.name}" (#${flow.id}) crashed:`, error)
    })
}

/** Everything except the credentials the caller sent us. */
function safeHeaders(headers: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {}
    for (const [key, value] of Object.entries(headers)) {
        const lower = key.toLowerCase()
        if (lower === 'authorization' || lower === 'cookie' || lower === 'x-flow-secret') continue
        out[lower] = value
    }
    return out
}

@Controller()
export default class FlowWebhookController {
    @Post(`${WEBHOOK_PREFIX}/:token`)
    async receive(req: Request, res: Response): Promise<any> {
        return handle(req, res)
    }

    /**
     * Several providers verify a URL with a GET before they will save it, so the
     * same handler answers both. A GET with no body simply starts the flow with
     * an empty record.
     */
    @Get(`${WEBHOOK_PREFIX}/:token`)
    async verify(req: Request, res: Response): Promise<any> {
        return handle(req, res)
    }
}

export const AvailableRouteMethods = ['receive', 'verify'] as const
