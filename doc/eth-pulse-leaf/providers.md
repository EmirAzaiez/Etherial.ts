# ETHPulseLeaf Providers

## Overview

ETHPulseLeaf uses a provider-based architecture. Each messaging channel (SMS, Email) has an interface that providers must implement. This allows you to easily swap providers or add new ones.

---

## SMS Providers

### Interface: `ISmsProvider`

```typescript
interface ISmsProvider {
    readonly name: string
    send(to: string, message: string): Promise<SmsResult>
    sendBulk(recipients: string[], message: string): Promise<SmsResult[]>
    sendWithOptions(options: SmsOptions): Promise<SmsResult>
}

interface SmsResult {
    success: boolean
    messageId?: string
    error?: string
    provider: string
    timestamp: Date
}

interface SmsOptions {
    to: string
    message: string
    from?: string  // Override default sender
}
```

### Built-in: TwilioProvider

Full Twilio SMS integration.

**Configuration:**
```typescript
{
    accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    authToken: 'your_auth_token',
    fromNumber: '+15551234567'
}
```

**Features:**
- Single message sending
- Bulk sending with parallel requests
- Custom sender number per message
- Automatic error handling

---

## Email Providers

### Interface: `IEmailProvider`

```typescript
interface IEmailProvider {
    readonly name: string
    send(options: EmailOptions): Promise<EmailResult>
    sendTransactional(to, subject, content): Promise<EmailResult>
    sendFromTemplate(templateName, options): Promise<EmailResult>
}

interface EmailResult {
    success: boolean
    messageId?: string
    error?: string
    provider: string
    timestamp: Date
}

interface EmailOptions {
    to: string | string[]
    subject: string
    text?: string
    html?: string
    from?: string
    replyTo?: string
    cc?: string | string[]
    bcc?: string | string[]
    attachments?: EmailAttachment[]
}

interface TransactionalContent {
    title?: string
    preheader?: string
    greeting?: string
    body: string          // Required - HTML content
    buttonText?: string
    buttonUrl?: string
    footer?: string
    additionalContent?: string
}
```

### Built-in: NodemailerProvider

SMTP-based email sending via Nodemailer.

**Configuration:**
```typescript
{
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'you@gmail.com',
        pass: 'app_password'
    },
    from: 'YourApp <noreply@yourapp.com>'
}
```

**Features:**
- Raw HTML/text email sending
- Built-in transactional template rendering
- Custom EJS template support
- Attachments support
- CC/BCC support

---

## Adding Custom Providers

### Example: Adding Resend Email Provider

1. Create the provider file:

```typescript
// providers/email/ResendProvider.ts
import { Resend } from 'resend'
import { IEmailProvider, EmailResult, EmailOptions, TransactionalContent, TemplateEmailOptions } from './IEmailProvider'
import { TemplateConfig } from '../../templates/TemplateEngine'

export interface ResendConfig {
    apiKey: string
    from: string
}

export class ResendProvider implements IEmailProvider {
    readonly name = 'resend'
    private client: Resend
    private defaultFrom: string

    constructor(config: ResendConfig, private templateConfig?: TemplateConfig) {
        this.client = new Resend(config.apiKey)
        this.defaultFrom = config.from
    }

    async send(options: EmailOptions): Promise<EmailResult> {
        try {
            const { data, error } = await this.client.emails.send({
                from: options.from || this.defaultFrom,
                to: Array.isArray(options.to) ? options.to : [options.to],
                subject: options.subject,
                html: options.html,
                text: options.text,
            })

            if (error) {
                return { success: false, error: error.message, provider: this.name, timestamp: new Date() }
            }

            return { success: true, messageId: data?.id, provider: this.name, timestamp: new Date() }
        } catch (e) {
            return { success: false, error: e.message, provider: this.name, timestamp: new Date() }
        }
    }

    // Implement sendTransactional and sendFromTemplate...
}
```

2. Register in app.ts constructor:

```typescript
if (name === 'resend') {
    this.emailProviders.set(name, new ResendProvider(providerConfig as ResendConfig, this.templateConfig))
}
```

3. Add to config types:

```typescript
export interface EmailProviderConfig {
    nodemailer?: NodemailerConfig
    resend?: ResendConfig  // Add this
}
```

---

## Provider Selection

```typescript
// Use default provider (from config.email.default)
await etherial.eth_pulse_leaf.email().send({...})

// Use specific provider
await etherial.eth_pulse_leaf.email('resend').send({...})

// Check available providers
const emailService = etherial.eth_pulse_leaf.email()
console.log(emailService.provider().name)  // Current provider name
```
