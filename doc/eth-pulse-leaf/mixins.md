# ETHPulseLeaf - Mixins

Mixins allow you to add messaging functionality to any model, particularly the `User` model.

## UserPulseMixin

This mixin adds three methods to your User model for sending notifications via configured providers.

### What is a Mixin?

A mixin is a composition pattern that allows adding methods to a class without using multiple inheritance (which TypeScript doesn't support). It's particularly useful when you want to combine `ETHUserLeaf` features (authentication) with `ETHPulseLeaf` features (messaging).

### Installation

In your `src/models/User.ts` file:

```typescript
import { Table } from 'etherial/components/database/provider'
import { UserLeafBase } from './ETHUserLeaf/models/User'
import { applyPulseMixin } from './ETHPulseLeaf/mixins/UserPulseMixin'

// Apply the mixin to add messaging methods
@Table({ tableName: 'users', freezeTableName: true })
export class User extends applyPulseMixin(UserLeafBase) {
    // Your custom fields here...
}
```

With this setup, your `User` class inherits all methods from `UserLeafBase` (authentication, password reset, etc.) **plus** the messaging methods from the mixin.

---

## Available Methods

### `sendPushNotification()`

Sends a push notification to **all active devices** belonging to the user.

```typescript
await user.sendPushNotification(
    title: string,               // Notification title
    body: string,                // Message body
    data?: Record<string, any>,  // Custom data payload (optional)
    providerName?: string        // Provider to use (optional, e.g., 'expo')
): Promise<PushResult[]>
```

**Examples:**

```typescript
// Simple
await user.sendPushNotification('New Order', 'Your order has been shipped!')

// With custom data
await user.sendPushNotification(
    'Message Received',
    'You have a new message',
    { 
        orderId: 123,
        screen: 'OrderDetail' 
    }
)

// With specific provider
await user.sendPushNotification('Alert', 'Important!', {}, 'expo')
```

**Returns:** An array of `PushResult` for each device.

---

### `sendSms()`

Sends an SMS to the user's phone number (`phone` field).

```typescript
await user.sendSms(
    message: string,         // SMS content
    providerName?: string    // Provider to use (optional, e.g., 'twilio')
): Promise<PulseResult>
```

**Examples:**

```typescript
// Simple
await user.sendSms('Your verification code is 1234')

// With specific provider
await user.sendSms('Welcome!', 'twilio')
```

**Prerequisite:** The user must have a phone number in the `phone` field.

---

### `sendEmail()`

Sends a transactional email to the user's email address.

```typescript
await user.sendEmail(
    subject: string,         // Email subject
    content: {               // Transactional content
        title?: string,      // Title in template
        greeting?: string,   // Greeting message
        body: string,        // Main HTML content
        footer?: string      // Footer text
    },
    providerName?: string    // Provider to use (optional, e.g., 'nodemailer')
): Promise<PulseResult>
```

**Examples:**

```typescript
// Welcome email
await user.sendEmail('Welcome to our platform!', {
    title: 'Welcome!',
    greeting: `Hello ${user.firstname},`,
    body: `
        <p>We're excited to have you on board.</p>
        <p>Explore all our features now!</p>
    `,
    footer: 'See you soon!'
})

// Confirmation email
await user.sendEmail('Order Confirmation', {
    title: 'Order Confirmed',
    body: '<p>Your order #12345 has been confirmed.</p>',
})

// With specific provider
await user.sendEmail('Alert', { body: 'Important!' }, 'nodemailer')
```

---

## Error Handling

Each method returns an object with `success: boolean`. If the provider isn't configured or the user lacks required data, a warning is logged and the operation fails gracefully.

```typescript
const result = await user.sendSms('Hello')

if (!result.success) {
    console.error('SMS failed:', result.error)
    // Possible errors:
    // - "ETHPulseLeaf not configured"
    // - "User has no phone number"
    // - Provider-specific error
}
```

---

## Required Configuration

The mixin uses `ETHPulseLeaf` services. Make sure you have configured the appropriate providers:

```typescript
// Config.ts
eth_pulse_leaf: {
    module: ETHPulseLeaf,
    config: {
        sms: {
            default: 'twilio',
            providers: { twilio: { /* ... */ } }
        },
        email: {
            default: 'nodemailer', 
            providers: { nodemailer: { /* ... */ } }
        },
        push: {
            default: 'expo',
            providers: { expo: { /* ... */ } }
        },
        routes: {
            devices: ['registerDevice', 'revokeDevice']
        }
    }
}
```

---

## PulseResult Interface

```typescript
interface PulseResult {
    success: boolean
    error?: string
    messageId?: string
}
```
