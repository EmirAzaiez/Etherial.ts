# Using ETHPulseLeaf

## Strategy: Why & When?

### Why use this Leaf?
Messaging (SMS, Email, Push) is essential for modern apps but tedious to implement correctly. `ETHPulseLeaf` provides:
- **Provider Abstraction**: Swap Twilio for another SMS provider without changing your code.
- **Beautiful Templates**: Pre-built responsive email templates with your branding.
- **Push Notifications**: Built-in Expo push support with device management.
- **Message Logging**: Track all sent messages for debugging and analytics.
- **Type Safety**: Fully typed API with IntelliSense support.

### When NOT to use it?
- If you're using a fully-managed service like Customer.io or Braze for all messaging.

---

## Quick Start

### SMS

```typescript
// Simple send
await etherial.eth_pulse_leaf.sms().send('+33612345678', 'Hello World!')

// Bulk send
await etherial.eth_pulse_leaf.sms().sendBulk(
    ['+33612345678', '+33687654321'],
    'Flash sale starts now!'
)

// Verification code helper
await etherial.eth_pulse_leaf.sms().sendVerificationCode('+33612345678', '123456')
```

### Push Notifications

```typescript
// Send to a specific token
await etherial.eth_pulse_leaf.push().send('ExponentPushToken[...]', {
    title: 'New Message',
    body: 'You have a new message!',
    data: { screen: 'Messages' }
})

// Send to a Device model instance
const device = await Device.findByPk(1)
await etherial.eth_pulse_leaf.push().sendToDevice(device, {
    title: 'Order Shipped',
    body: 'Your order is on the way!'
})

// Send to multiple devices
const devices = await Device.findAll({ where: { user_id: userId } })
await etherial.eth_pulse_leaf.push().sendToDevices(devices, {
    title: 'Announcement',
    body: 'Check out our new features!'
})
```

### Email - Transactional (Built-in Template)

```typescript
await etherial.eth_pulse_leaf.email().sendTransactional(
    'user@example.com',
    'Welcome to YourApp!',
    {
        title: 'Welcome!',
        preheader: 'Your account is ready', // Gmail preview text
        greeting: 'Hi John,',
        body: `
            <p>Thanks for signing up! We're thrilled to have you.</p>
            <p>Get started by exploring your dashboard.</p>
        `,
        buttonText: 'Go to Dashboard',
        buttonUrl: 'https://yourapp.com/dashboard',
        footer: 'Need help? Just reply to this email!'
    }
)
```

### Email - Preset Templates

```typescript
// Password Reset
await etherial.eth_pulse_leaf.email().sendPasswordReset(
    'user@example.com',
    'https://yourapp.com/reset?token=abc123',
    'John',      // userName (optional)
    '1 hour'     // expiresIn (optional)
)

// Email Verification
await etherial.eth_pulse_leaf.email().sendEmailVerification(
    'user@example.com',
    'https://yourapp.com/verify?token=xyz',
    '123456',    // verificationCode (optional, shows in email)
    'John'       // userName (optional)
)

// Welcome Email
await etherial.eth_pulse_leaf.email().sendWelcome(
    'user@example.com',
    'https://yourapp.com/dashboard',
    'John',
    ['Create your first project', 'Invite your team', 'Explore templates']
)
```

### Email - Custom EJS Template

```typescript
// Uses template from customTemplatesPath or presets folder
await etherial.eth_pulse_leaf.email().sendFromTemplate(
    'invoice',  // Looks for invoice.ejs
    {
        to: 'user@example.com',
        subject: 'Your Invoice #12345',
        data: {
            invoiceNumber: 'INV-12345',
            amount: '$99.00',
            items: [
                { name: 'Pro Plan', price: '$99.00' }
            ]
        }
    }
)
```

---

## Using Specific Providers

By default, the `default` provider is used. You can specify a different one:

```typescript
// Use specific SMS provider
await etherial.eth_pulse_leaf.sms('twilio').send('+33612345678', 'Hello!')

// Use specific Email provider
await etherial.eth_pulse_leaf.email('nodemailer').send({
    to: 'user@example.com',
    subject: 'Test',
    html: '<p>Hello</p>'
})
```

---

## Creating Custom Templates

### 1. Set the custom templates path in config

```typescript
templates: {
    customTemplatesPath: './src/templates/emails'
}
```

### 2. Create an EJS file

```ejs
<!-- src/templates/emails/order_confirmation.ejs -->
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .order-box { background: #f0f0f0; padding: 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <h1>Order Confirmed! 🎉</h1>
    <p>Hi <%= data.userName %>,</p>
    <div class="order-box">
        <p><strong>Order #:</strong> <%= data.orderNumber %></p>
        <p><strong>Total:</strong> <%= data.total %></p>
    </div>
    <p>We'll send tracking info once it ships.</p>
    <p>Thanks for shopping with <%= config.companyName %>!</p>
</body>
</html>
```

### 3. Use it

```typescript
await etherial.eth_pulse_leaf.email().sendFromTemplate('order_confirmation', {
    to: 'customer@example.com',
    subject: 'Order #12345 Confirmed',
    data: {
        userName: 'John',
        orderNumber: '12345',
        total: '$149.99'
    }
})
```

---

## Template Configuration

The built-in transactional template uses these config values:

| Property | Type | Description |
|----------|------|-------------|
| `logoUrl` | `string` | URL to your logo (displayed in header) |
| `primaryColor` | `string` | Main brand color (buttons, gradients) |
| `secondaryColor` | `string` | Secondary gradient color |
| `companyName` | `string` | Your company name |
| `footerText` | `string` | Footer copyright text |
| `socialLinks.twitter` | `string` | Twitter profile URL |
| `socialLinks.instagram` | `string` | Instagram profile URL |
| `socialLinks.facebook` | `string` | Facebook page URL |
| `socialLinks.linkedin` | `string` | LinkedIn page URL |

---

## TransactionalContent Fields

| Field | Required | Description |
|-------|----------|-------------|
| `title` | No | Header title (big text in gradient area) |
| `preheader` | No | Gmail preview text (hidden in email) |
| `greeting` | No | Greeting line (e.g., "Hi John,") |
| `body` | **Yes** | Main content (HTML allowed) |
| `buttonText` | No | CTA button text |
| `buttonUrl` | No | CTA button URL |
| `additionalContent` | No | Extra content after button |
| `footer` | No | Footer note before company info |

---

## Integration with ETHUserLeaf (Mixin)

The easiest way to integrate is using the `UserPulseMixin`:

```typescript
// src/models/User.ts
import { UserLeafBase } from './ETHUserLeaf/models/User'
import { applyPulseMixin } from './ETHPulseLeaf/mixins/UserPulseMixin'

@Table({ tableName: 'users' })
export class User extends applyPulseMixin(UserLeafBase) {
    // Your custom fields...
}
```

Now you have these methods available on User:

```typescript
// Push to all user's devices
await user.sendPushNotification('Title', 'Body', { custom: 'data' })

// SMS to user's phone
await user.sendSms('Your code is 1234')

// Email to user
await user.sendEmail('Welcome!', { title: 'Hi', body: '<p>Welcome!</p>' })
```

See [mixins.md](./mixins.md) for detailed documentation.

---

## Message Logging

All messages are automatically logged to the `message_logs` table:

```typescript
import { MessageLog, MessageType, MessageStatus } from './ETHPulseLeaf'

// Query logs
const recentEmails = await MessageLog.findAll({
    where: {
        type: MessageType.EMAIL,
        status: MessageStatus.SENT,
        created_at: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }
})

// Get failed messages
const failed = await MessageLog.findAll({
    where: { status: MessageStatus.FAILED }
})
```
