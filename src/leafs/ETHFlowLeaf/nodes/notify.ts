// ──────────────────────────────────────────────────────────────────────────
// Sending things to people.
//
// Backed by ETHPulseLeaf, which already owns the providers, the templates and
// the message log. These steps only exist when that leaf is configured — a
// palette offering "send an SMS" to a project with no SMS provider produces a
// flow that fails at three in the morning instead of at design time.
// ──────────────────────────────────────────────────────────────────────────

import etherial from 'etherial'

import { registry } from '../registry/Registry.js'
import type { NodeDefinition } from '../types.js'

function pulse(): any | null {
    return (etherial as any).eth_pulse_leaf ?? null
}

function hasService(kind: 'sms' | 'email' | 'push'): boolean {
    const leaf = pulse()
    if (!leaf) return false
    try {
        // The accessor throws when nothing is configured, which is exactly the
        // question being asked.
        leaf[kind]()
        return true
    } catch {
        return false
    }
}

export const emailNode: NodeDefinition = {
    id: 'notify.email',
    label: 'Send an email',
    icon: 'Mail',
    category: 'notify',
    available: () => hasService('email'),
    config: [
        {
            name: 'to',
            type: 'string',
            label: 'To',
            required: true,
            helpText: 'One address, or several separated by commas. Usually {{record.customer.email}}.',
        },
        { name: 'subject', type: 'string', label: 'Subject', required: true },
        {
            name: 'format',
            type: 'select',
            label: 'Body',
            defaultValue: 'transactional',
            options: [
                { value: 'transactional', label: 'Styled — the workspace template' },
                { value: 'text', label: 'Plain text' },
                { value: 'html', label: 'Raw HTML' },
            ],
        },
        { name: 'body', type: 'text', label: 'Message', required: true },
        {
            name: 'button_text',
            type: 'string',
            label: 'Button',
            showIf: { field: 'format', operator: 'eq', value: 'transactional' },
        },
        {
            name: 'button_url',
            type: 'string',
            label: 'Button link',
            showIf: { field: 'format', operator: 'eq', value: 'transactional' },
        },
    ],
    output: [
        { key: 'sent', label: 'Sent', type: 'boolean' },
        { key: 'recipients', label: 'Recipients', type: 'array' },
    ],
    execute: async ({ config, log }) => {
        const recipients = splitRecipients(config.to)
        if (recipients.length === 0) {
            // Not an error: a customer without an email address is a normal state
            // of the world, and failing the run would bury the useful steps.
            log('No address to send to')
            return { output: { sent: false, recipients: [] } }
        }

        const service = pulse().email()

        if (config.format === 'transactional') {
            // `sendTransactional` names its recipient `email`, where the plain
            // `send` below names it `to`. Passing the wrong one sends to nobody.
            const result = await service.sendTransactional({
                email: recipients,
                subject: String(config.subject ?? ''),
                content: {
                    title: String(config.subject ?? ''),
                    body: String(config.body ?? ''),
                    buttonText: config.button_text || undefined,
                    buttonUrl: config.button_url || undefined,
                },
            })
            log(`Sent to ${recipients.join(', ')}`)
            return { output: { sent: result?.success !== false, recipients } }
        }

        const result = await service.send({
            to: recipients,
            subject: String(config.subject ?? ''),
            ...(config.format === 'html'
                ? { html: String(config.body ?? '') }
                : { text: String(config.body ?? '') }),
        })

        log(`Sent to ${recipients.join(', ')}`)
        return { output: { sent: result?.success !== false, recipients } }
    },
}

export const smsNode: NodeDefinition = {
    id: 'notify.sms',
    label: 'Send an SMS',
    icon: 'MessageSquare',
    category: 'notify',
    available: () => hasService('sms'),
    config: [
        {
            name: 'to',
            type: 'string',
            label: 'To',
            required: true,
            helpText: 'A phone number in international format.',
        },
        { name: 'message', type: 'text', label: 'Message', required: true, maxLength: 800 },
    ],
    output: [{ key: 'sent', label: 'Sent', type: 'boolean' }],
    execute: async ({ config, log }) => {
        const recipients = splitRecipients(config.to)
        if (recipients.length === 0) {
            log('No number to send to')
            return { output: { sent: false } }
        }

        const service = pulse().sms()
        const message = String(config.message ?? '')

        let sent = 0
        for (const phone of recipients) {
            const result = await service.send({ phone, message })
            if (result?.success !== false) sent += 1
            else log(`Failed for ${phone}: ${result?.error ?? 'unknown error'}`)
        }

        log(`${sent}/${recipients.length} sent`)
        return { output: { sent: sent > 0, count: sent } }
    },
}

export const pushNode: NodeDefinition = {
    id: 'notify.push',
    label: 'Send a push notification',
    icon: 'BellRing',
    category: 'notify',
    available: () => hasService('push'),
    config: [
        {
            name: 'target',
            type: 'select',
            label: 'To',
            defaultValue: 'user',
            options: [
                { value: 'user', label: "A user's devices" },
                { value: 'token', label: 'A device token' },
            ],
        },
        {
            name: 'user_id',
            type: 'string',
            label: 'User',
            defaultValue: '{{record.user_id}}',
            showIf: { field: 'target', operator: 'eq', value: 'user' },
        },
        {
            name: 'token',
            type: 'string',
            label: 'Device token',
            showIf: { field: 'target', operator: 'eq', value: 'token' },
        },
        { name: 'title', type: 'string', label: 'Title', required: true },
        { name: 'body', type: 'text', label: 'Message', required: true },
        {
            name: 'data',
            type: 'json',
            label: 'Payload',
            helpText: 'Passed through to the app — a screen to open, an id to load.',
        },
    ],
    output: [
        { key: 'sent', label: 'Sent', type: 'boolean' },
        { key: 'devices', label: 'Devices reached', type: 'number' },
    ],
    execute: async ({ config, log }) => {
        const leaf = pulse()
        const service = leaf.push()
        const message = {
            title: String(config.title ?? '') || leaf.config?.push?.defaultNotificationTitle,
            body: String(config.body ?? ''),
            data: config.data && typeof config.data === 'object' ? config.data : undefined,
        }

        if (config.target === 'token') {
            const token = String(config.token ?? '').trim()
            if (!token) {
                log('No device token')
                return { output: { sent: false, devices: 0 } }
            }
            const result = await service.send(token, message)
            return { output: { sent: result?.success !== false, devices: 1 } }
        }

        const userId = config.user_id
        if (userId === null || userId === undefined || userId === '') {
            log('No user to notify')
            return { output: { sent: false, devices: 0 } }
        }

        const Device = (etherial as any).database?.sequelize?.models?.Device
        if (!Device) {
            log('No device registry — is ETHPulseLeaf installed with its models?')
            return { output: { sent: false, devices: 0 } }
        }

        // `status: true` is what the rest of the project means by "a device we
        // still send to" — one the user logged out of is still a row here, and
        // pushing to it fails or reaches a phone that no longer expects it.
        const devices = await Device.findAll({ where: { user_id: userId, status: true } })
        if (devices.length === 0) {
            // Someone who never opened the app. Worth a line in the log, not a
            // failed run.
            log(`User ${userId} has no registered device`)
            return { output: { sent: false, devices: 0 } }
        }

        const results = await service.sendToDevices(devices, message)
        const sent = results.filter((result: any) => result?.success !== false).length
        log(`${sent}/${devices.length} device${devices.length === 1 ? '' : 's'}`)

        return { output: { sent: sent > 0, devices: sent } }
    },
}

function splitRecipients(value: any): string[] {
    if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean)
    return String(value ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
}

export function registerNotifyNodes(): void {
    registry.registerNode(emailNode)
    registry.registerNode(smsNode)
    registry.registerNode(pushNode)
}
