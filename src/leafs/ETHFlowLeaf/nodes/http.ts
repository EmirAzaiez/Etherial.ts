// Calling something else.
//
// The escape hatch. Whatever the palette does not cover — a Slack webhook, a
// CRM, an internal service — is one HTTP request away, and a customer who can
// paste a URL from a vendor's documentation can wire it up themselves.

import { registry } from '../registry/Registry.js'
import type { NodeDefinition } from '../types.js'

const TIMEOUT_MS = 20000

export const requestNode: NodeDefinition = {
    id: 'http.request',
    label: 'Call a URL',
    description: 'Sends an HTTP request and hands the answer to the next steps.',
    icon: 'Globe',
    category: 'integration',
    config: [
        {
            name: 'method',
            type: 'select',
            label: 'Method',
            defaultValue: 'POST',
            options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => ({
                value: method,
                label: method,
            })),
        },
        { name: 'url', type: 'string', label: 'URL', required: true },
        {
            name: 'headers',
            type: 'json',
            label: 'Headers',
            helpText: 'An object — { "Authorization": "Bearer ..." }.',
        },
        {
            name: 'body',
            type: 'text',
            label: 'Body',
            helpText: 'JSON, or anything else. Templates work here too.',
            showIf: { field: 'method', operator: 'in', value: ['POST', 'PUT', 'PATCH', 'DELETE'] },
        },
        {
            name: 'content_type',
            type: 'select',
            label: 'Send as',
            defaultValue: 'application/json',
            options: [
                { value: 'application/json', label: 'JSON' },
                { value: 'application/x-www-form-urlencoded', label: 'Form' },
                { value: 'text/plain', label: 'Text' },
            ],
            showIf: { field: 'method', operator: 'in', value: ['POST', 'PUT', 'PATCH', 'DELETE'] },
        },
        {
            name: 'fail_on_error',
            type: 'boolean',
            label: 'Treat a non-2xx answer as a failure',
            defaultValue: true,
        },
    ],
    branches: [
        { id: 'ok', label: 'Succeeded' },
        { id: 'error', label: 'Failed' },
    ],
    output: [
        { key: 'status', label: 'Status code', type: 'number' },
        { key: 'ok', label: 'Succeeded', type: 'boolean' },
        { key: 'body', label: 'Body', type: 'object' },
        { key: 'text', label: 'Raw body', type: 'string' },
    ],
    execute: async ({ config, log }) => {
        const url = String(config.url ?? '').trim()
        if (!/^https?:\/\//i.test(url)) throw new Error(`"${url}" is not an http(s) URL`)

        const method = String(config.method || 'POST').toUpperCase()
        const headers: Record<string, string> = {}

        if (config.headers && typeof config.headers === 'object') {
            for (const [key, value] of Object.entries(config.headers)) {
                headers[key] = String(value)
            }
        }

        let body: string | undefined
        if (method !== 'GET' && config.body !== undefined && config.body !== null && config.body !== '') {
            body = typeof config.body === 'string' ? config.body : JSON.stringify(config.body)
            if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
                headers['Content-Type'] = config.content_type || 'application/json'
            }
        }

        // Without a deadline a hung endpoint holds the run open indefinitely, and
        // on a scheduled flow that means the next tick piles up behind it.
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

        let response: Response
        try {
            response = await fetch(url, { method, headers, body, signal: controller.signal })
        } catch (error: any) {
            clearTimeout(timer)
            if (error?.name === 'AbortError') throw new Error(`${url} did not answer within 20 seconds`)
            throw error
        }
        clearTimeout(timer)

        const text = await response.text()
        let parsed: any = null
        try {
            parsed = text ? JSON.parse(text) : null
        } catch {
            parsed = null
        }

        log(`${method} ${url} → ${response.status}`)

        if (!response.ok && config.fail_on_error !== false) {
            throw new Error(`${method} ${url} answered ${response.status}: ${text.slice(0, 200)}`)
        }

        return {
            branch: response.ok ? 'ok' : 'error',
            output: {
                status: response.status,
                ok: response.ok,
                body: parsed,
                text,
            },
        }
    },
}

export function registerHttpNodes(): void {
    registry.registerNode(requestNode)
}
