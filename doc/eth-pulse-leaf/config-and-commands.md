# ETHPulseLeaf Configuration & Commands

## Installation

```bash
etherial leaf:add ETHPulseLeaf
```

## Configuration

The module is configured in your `src/Config.ts` file.

```typescript
import ETHPulseLeaf, { ETHPulseLeafConfig } from './ETHPulseLeaf/app'

export default {
    eth_pulse_leaf: {
        module: ETHPulseLeaf,
        config: {
            sms: {
                default: 'twilio',
                providers: {
                    twilio: {
                        accountSid: process.env.TWILIO_ACCOUNT_SID!,
                        authToken: process.env.TWILIO_AUTH_TOKEN!,
                        fromNumber: process.env.TWILIO_PHONE_NUMBER!,
                    }
                }
            },
            email: {
                default: 'nodemailer',
                providers: {
                    nodemailer: {
                        host: process.env.SMTP_HOST!,
                        port: parseInt(process.env.SMTP_PORT || '587'),
                        secure: process.env.SMTP_SECURE === 'true',
                        auth: {
                            user: process.env.SMTP_USER!,
                            pass: process.env.SMTP_PASS!,
                        },
                        from: process.env.SMTP_FROM!,
                    }
                }
            },
            push: {
                default: 'expo',
                providers: {
                    expo: {
                        accessToken: process.env.EXPO_ACCESS_TOKEN, // Optional
                    }
                }
            },
            routes: {
                devices: ['registerDevice', 'revokeDevice']
            },
            templates: {
                logoUrl: 'https://yourapp.com/logo.png',
                primaryColor: '#6366F1',
                secondaryColor: '#818CF8',
                companyName: 'YourApp',
                footerText: '© 2026 YourApp. All rights reserved.',
                socialLinks: {
                    twitter: 'https://twitter.com/yourapp',
                    instagram: 'https://instagram.com/yourapp',
                },
                customTemplatesPath: './src/templates/emails', // Optional
            }
        } satisfies ETHPulseLeafConfig
    }
}
```

## Environment Variables

### SMS (Twilio)

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | For SMS | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | For SMS | `your_auth_token` |
| `TWILIO_PHONE_NUMBER` | Sender phone number | For SMS | `+15551234567` |

### Email (SMTP)

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `SMTP_HOST` | SMTP server host | For Email | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | No (587) | `587` |
| `SMTP_SECURE` | Use TLS/SSL | No (false) | `false` |
| `SMTP_USER` | SMTP username | For Email | `you@gmail.com` |
| `SMTP_PASS` | SMTP password | For Email | `app_password` |
| `SMTP_FROM` | Default sender | For Email | `noreply@yourapp.com` |

### Push Notifications (Expo)

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `EXPO_ACCESS_TOKEN` | Expo access token | No | `ExponentPushToken[...]` |

## Routes (Devices)

When `routes.devices` is configured, the following endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/devices/register` | POST | Register/update a device for push notifications |
| `/devices/revoke` | POST | Revoke a device (requires auth) |

## Commands

| Command | Description | Usage |
|---------|-------------|-------|
| `test-email` | Send a test email | `npx etherial eth_pulse_leaf:test-email you@example.com` |
| `test-sms` | Send a test SMS | `npx etherial eth_pulse_leaf:test-sms +33612345678` |
| `test-push` | Send a test push | `npx etherial eth_pulse_leaf:test-push ExponentPushToken[...]` |
