// An inbound HTTP call starts the flow.
//
// The credential is the flow's own token in the URL, and nothing else: the
// callers are payment providers, form builders and Zapier-shaped things that
// cannot be taught a login. A token is regenerable from the builder, which is
// the recovery path when one leaks.
import { registry } from '../registry/Registry.js';
export const webhookTrigger = {
    id: 'webhook.received',
    label: 'When a webhook is received',
    description: 'Gives the automation a URL. Anything that can POST can start it.',
    icon: 'Webhook',
    kind: 'webhook',
    group: 'Incoming',
    config: [
        {
            name: 'secret',
            type: 'string',
            label: 'Shared secret',
            secure: true,
            helpText: 'Optional. When set, the call must carry it as X-Flow-Secret — worth doing for anything that costs money.',
        },
    ],
    payload: [
        { key: 'body', label: 'Body', type: 'object' },
        { key: 'query', label: 'Query string', type: 'object' },
        { key: 'headers', label: 'Headers', type: 'object' },
        { key: 'method', label: 'Method', type: 'string' },
        { key: 'ip', label: 'Caller IP', type: 'string' },
    ],
    // The record is the body: a webhook that posts a customer wants
    // `{{record.email}}` to work the way it does everywhere else.
    output: [],
};
export function registerWebhookTrigger() {
    registry.registerTrigger(webhookTrigger);
}
