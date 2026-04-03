import * as yup from 'yup'
import { Action, ActionResult } from '../../ETHAdminLeaf/features/ActionRegistry.js'
import { Hook } from '../../ETHAdminLeaf/features/HookRegistry.js'
import { DevicePushTokenStatus } from '../models/Device.js'
import { Op } from 'sequelize'
import etherial from 'etherial'

const getModels = () => {
    const models = etherial.database!.sequelize.models
    return {
        Device: models.Device as any,
        MessageLog: models.MessageLog as any,
        NotificationCampaign: models.NotificationCampaign as any,
    }
}

const getPulseLeaf = () => (etherial as any).eth_pulse_leaf

// ============================================
// ACTIONS (User-triggered, buttons in UI)
// ============================================

export const pulseActions: Record<string, Omit<Action, 'name'>> = {
    'pulse:send-push': {
        meta: {
            label: 'Send Push Notification',
            description: 'Send a push notification to this user',
            icon: 'bell',
            color: 'primary',
            category: 'notifications',
            confirm: {
                title: 'Send Push Notification',
                message: 'Are you sure you want to send a push notification?',
                confirmText: 'Send',
                cancelText: 'Cancel'
            }
        },
        form: yup.object({
            title: yup.string().label('Title'),
            message: yup.string().required().max(500).label('Message'),
            url: yup.string().url().label('Link (optional)')
        }),
        handler: async (record, data, _req, _context): Promise<ActionResult> => {
            const { title, message, url } = data

            const { Device } = getModels()
            const devices = await Device.findAll({
                where: {
                    user_id: record.id,
                    push_token_status: DevicePushTokenStatus.ENABLED,
                    status: true
                }
            })

            const tokens = devices.map(d => d.push_token).filter(Boolean)
            if (tokens.length === 0) {
                return { success: true, data: { sent_to: 0, message: 'No active devices' } }
            }

            const pulseLeaf = getPulseLeaf()
            const defaultTitle = pulseLeaf?.config?.push?.defaultNotificationTitle || 'Notification'

            // Build notification data (same format as campaigns)
            let notificationData: any = {}
            if (url) {
                notificationData.location = 'ExternalLink'
                notificationData.url = url
            }

            await pulseLeaf.push().sendMultiple(tokens, {
                title: title || defaultTitle,
                body: message,
                data: notificationData
            })

            return { success: true, data: { sent_to: tokens.length } }
        }
    },

    'pulse:send-sms': {
        meta: {
            label: 'Send SMS',
            description: 'Send an SMS to this user',
            icon: 'message-square',
            color: 'primary',
            category: 'notifications',
            confirm: {
                title: 'Send SMS',
                message: 'Are you sure you want to send an SMS?',
                confirmText: 'Send',
                cancelText: 'Cancel'
            }
        },
        form: yup.object({
            message: yup.string().required().max(160).label('Message')
        }),
        handler: async (record, data, _req, _context): Promise<ActionResult> => {
            const phone = record.phone_number || record.phone || record.mobile
            if (!phone) {
                return { success: false, error: 'No phone number found' }
            }

            const pulseLeaf = getPulseLeaf()
            const result = await pulseLeaf.sms().send({ phone, message: data.message })

            return result.success
                ? { success: true, data: { sent: true, phone } }
                : { success: false, error: result.error }
        }
    },

    'pulse:send-email': {
        meta: {
            label: 'Send Email',
            description: 'Send an email to this user',
            icon: 'mail',
            color: 'primary',
            category: 'notifications',
            confirm: {
                title: 'Send Email',
                message: 'Are you sure you want to send an email?',
                confirmText: 'Send',
                cancelText: 'Cancel'
            }
        },
        form: yup.object({
            subject: yup.string().required().label('Subject'),
            body: yup.string().required().max(50000).label('Body')
        }),
        handler: async (record, data, _req, _context): Promise<ActionResult> => {
            const email = record.email
            if (!email) {
                return { success: false, error: 'No email found' }
            }

            const pulseLeaf = getPulseLeaf()
            const result = await pulseLeaf.email().sendTransactional({
                email,
                subject: data.subject,
                content: {
                    title: data.subject,
                    greeting: `Hello ${record.first_name || record.firstname || ''}`.trim(),
                    body: data.body
                }
            })

            return result.success
                ? { success: true, data: { sent: true, email } }
                : { success: false, error: result.error }
        }
    },

    'pulse:revoke-devices': {
        meta: {
            label: 'Revoke All Devices',
            description: 'Log out user from all devices',
            icon: 'shield-off',
            color: 'danger',
            category: 'security',
            confirm: {
                title: 'Revoke All Devices',
                message: 'This will log out the user from all devices. Are you sure?',
                confirmText: 'Revoke All',
                cancelText: 'Cancel'
            }
        },
        handler: async (record, _data, _req, _context): Promise<ActionResult> => {
            const { Device } = getModels()
            const [count] = await Device.update(
                { status: false, push_token_status: DevicePushTokenStatus.DISABLED },
                { where: { user_id: record.id } }
            )
            return { success: true, data: { revoked_count: count } }
        }
    },

}

// ============================================
// HOOKS (Auto-triggered on CRUD)
// ============================================

export const pulseHooks: Record<string, Omit<Hook, 'name'>> = {
    'pulse:send-campaign': {
        collection: 'campaigns',
        description: 'Auto-send push notifications when campaign is created',
        afterCreate: async (campaign: any, _req) => {
            try {
                const { message, url, data, target_logged_user, target_not_logged_user } = campaign

                let notificationData: any = data || {}
                if (url) {
                    notificationData.location = 'ExternalLink'
                    notificationData.url = url
                }

                const whereConditions: any = {
                    push_token_status: DevicePushTokenStatus.ENABLED,
                    status: true
                }

                if (target_logged_user && !target_not_logged_user) {
                    whereConditions.user_id = { [Op.ne]: null }
                } else if (!target_logged_user && target_not_logged_user) {
                    whereConditions.user_id = null
                }

                const { Device } = getModels()
                const devices = await Device.findAll({ where: whereConditions })
                await campaign.update({ devices_count: devices.length })

                if (devices.length === 0) {
                    console.log('[pulse:send-campaign] No devices found')
                    return
                }

                const tokens = devices.map(d => d.push_token).filter(Boolean)
                if (tokens.length > 0) {
                    const pulseLeaf = getPulseLeaf()
                    const defaultTitle = pulseLeaf?.config?.push?.defaultNotificationTitle || 'Notification'

                    await pulseLeaf.push().sendMultiple(tokens, {
                        title: defaultTitle,
                        body: message,
                        data: notificationData
                    })

                    console.log(`[pulse:send-campaign] Sent to ${tokens.length} devices`)
                }
            } catch (error: any) {
                console.error('[pulse:send-campaign] Error:', error.message)
            }
        }
    }
}

// ============================================
// COLLECTIONS (Admin panel data management)
// ============================================

export function registerPulseCollections(adminLeaf: { registerCollection: (config: any) => void }) {
    const EmailTemplate = etherial.database!.sequelize.models.EmailTemplate as any
    if (!EmailTemplate) {
        console.warn('[ETHPulseLeaf] EmailTemplate model not registered — skipping admin collection')
        return
    }

    // Build key field options from template definitions in config
    const pulseLeaf = getPulseLeaf()
    const definitions = pulseLeaf?.config?.email?.templates?.emails
    const keyOptions = definitions
        ? Object.entries(definitions).map(([key, vars]) => ({
            value: key,
            label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            helpText: `Variables: ${(vars as string[]).join(', ')}`,
        }))
        : undefined

    const keyField: any = {
        name: 'key',
        label: 'Template Key',
        required: true,
        searchable: true,
        sortable: true,
        filterable: true,
    }

    if (keyOptions && keyOptions.length > 0) {
        keyField.type = 'select'
        keyField.options = keyOptions
        keyField.helpText = 'Select a declared email template'
    } else {
        keyField.type = 'string'
        keyField.helpText = 'Template identifier (e.g. password_reset)'
    }

    adminLeaf.registerCollection({
        name: 'email_templates',
        model: EmailTemplate,
        crud: ['list', 'show', 'create', 'update', 'delete'],
        meta: {
            label: 'Email Template',
            labelPlural: 'Email Templates',
            icon: 'mail',
            description: 'Manage email templates and translations',
            group: 'Messaging',
            order: 10,
        },
        exportable: true,
        fields: [
            { name: 'id', type: 'number', readonly: true, hidden: true },
            keyField,
            { name: 'locale', type: 'string', label: 'Locale', required: true, sortable: true, filterable: true, helpText: 'Language code (e.g. en, fr, ar)', defaultValue: 'en' },
            { name: 'subject', type: 'string', label: 'Subject', required: true, searchable: true, helpText: 'Supports {{variable}} placeholders' },
            { name: 'title', type: 'string', label: 'Header Title', helpText: 'Displayed in the email header section' },
            { name: 'greeting', type: 'string', label: 'Greeting', helpText: 'e.g. Hello {{firstname}}' },
            { name: 'body', type: 'text', label: 'Body (HTML)', required: true, col: 12, helpText: 'HTML content with {{variable}} placeholders' },
            { name: 'button_text', type: 'string', label: 'Button Text' },
            { name: 'button_url', type: 'string', label: 'Button URL', helpText: 'e.g. {{baseUrl}}/reset/{{token}}' },
            { name: 'additional_content', type: 'text', label: 'Additional Content', col: 12 },
            { name: 'footer', type: 'string', label: 'Footer Text' },
            { name: 'enabled', type: 'boolean', label: 'Enabled', defaultValue: true, filterable: true },
            { name: 'created_at', type: 'datetime', readonly: true },
            { name: 'updated_at', type: 'datetime', readonly: true },
        ],
        views: {
            list: {
                fields: ['key', 'locale', 'subject', 'enabled', 'updated_at'],
                search: ['key', 'subject'],
                filters: ['key', 'locale', 'enabled'],
                sort: { field: 'key', direction: 'asc' },
            },
            show: {
                layout: 'sections',
                sections: [
                    { title: 'Identification', fields: ['key', 'locale', 'enabled'] },
                    { title: 'Content', fields: ['subject', 'title', 'greeting', 'body', 'button_text', 'button_url', 'additional_content', 'footer'] },
                ],
            },
            create: {
                layout: 'sections',
                sections: [
                    { title: 'Identification', fields: ['key', 'locale', 'enabled'] },
                    { title: 'Content', fields: ['subject', 'title', 'greeting', 'body', 'button_text', 'button_url', 'additional_content', 'footer'] },
                ],
            },
            edit: {
                layout: 'sections',
                sections: [
                    { title: 'Identification', fields: ['key', 'locale', 'enabled'] },
                    { title: 'Content', fields: ['subject', 'title', 'greeting', 'body', 'button_text', 'button_url', 'additional_content', 'footer'] },
                ],
            },
        },
    })

    console.log('[ETHPulseLeaf] Collection: email_templates')
}

// ============================================
// Registration
// ============================================

type ActionRegistry = { register: (name: string, action: Omit<Action, 'name'>) => void }
type HookRegistry = { register: (name: string, hook: Omit<Hook, 'name'>) => void }

export function registerPulseActions(registry: ActionRegistry) {
    for (const [name, action] of Object.entries(pulseActions)) {
        registry.register(name, action)
    }
    console.log('[ETHPulseLeaf] Actions:', Object.keys(pulseActions).join(', '))
}

export function registerPulseHooks(registry: HookRegistry) {
    for (const [name, hook] of Object.entries(pulseHooks)) {
        registry.register(name, hook)
    }
    console.log('[ETHPulseLeaf] Hooks:', Object.keys(pulseHooks).join(', '))
}

export function registerPulseFeatures(actions: ActionRegistry, hooks: HookRegistry) {
    registerPulseActions(actions)
    registerPulseHooks(hooks)
}
