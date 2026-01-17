# ETHPulseLeaf Models

## MessageLog

Tracks all SMS, Email, and Push notifications sent through the system.

### Table: `message_logs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | `number` | Primary key (auto-increment) |
| `type` | `enum` | Message type: `sms`, `email`, `push` |
| `provider` | `string` | Provider used (e.g., `twilio`, `nodemailer`) |
| `recipient` | `string` | Email address or phone number |
| `subject` | `string` | Email subject (null for SMS) |
| `status` | `enum` | `pending`, `sent`, `delivered`, `failed`, `bounced` |
| `external_id` | `string` | Provider's message ID |
| `error_message` | `string` | Error details if failed |
| `metadata` | `JSON` | Additional data (template name, etc.) |
| `user_id` | `number` | Associated user ID (optional) |
| `created_at` | `Date` | Creation timestamp |
| `updated_at` | `Date` | Last update timestamp |

### Enums

```typescript
enum MessageType {
    SMS = 'sms',
    EMAIL = 'email',
    PUSH = 'push',
}

enum MessageStatus {
    PENDING = 'pending',
    SENT = 'sent',
    DELIVERED = 'delivered',
    FAILED = 'failed',
    BOUNCED = 'bounced',
}
```

### Static Methods

#### `logMessage(data)`

Create a new log entry.

```typescript
await MessageLog.logMessage({
    type: MessageType.EMAIL,
    provider: 'nodemailer',
    recipient: 'user@example.com',
    subject: 'Welcome!',
    status: MessageStatus.SENT,
    externalId: 'msg-123',
    metadata: { templateName: 'welcome' },
    userId: 42
})
```

### Instance Methods

#### `updateStatus(status, externalId?, errorMessage?)`

Update the message status.

```typescript
const log = await MessageLog.findByPk(1)
await log.updateStatus(MessageStatus.DELIVERED, 'new-external-id')
```

#### `markAsSent(externalId?)`

Shortcut to mark as sent.

```typescript
await log.markAsSent('provider-message-id')
```

#### `markAsFailed(errorMessage)`

Shortcut to mark as failed.

```typescript
await log.markAsFailed('SMTP connection timeout')
```

---

## Usage Examples

### Get Failed Messages

```typescript
const failedMessages = await MessageLog.findAll({
    where: { status: MessageStatus.FAILED },
    order: [['created_at', 'DESC']],
    limit: 50
})
```

### Get User's Message History

```typescript
const userMessages = await MessageLog.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']]
})
```

### Count Messages by Type (Last 24h)

```typescript
import { Op, fn, col } from 'sequelize'

const stats = await MessageLog.findAll({
    attributes: [
        'type',
        [fn('COUNT', col('id')), 'count']
    ],
    where: {
        created_at: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    },
    group: ['type']
})
// Returns: [{ type: 'email', count: 150 }, { type: 'sms', count: 45 }]
```
