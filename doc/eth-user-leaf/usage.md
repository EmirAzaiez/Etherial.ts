# Using ETHUserLeaf

## Strategy: Why & When?

### Why use this Leaf?
Authentication is critical, security-sensitive, and tedious to implement. `ETHUserLeaf` gives you a **battle-tested foundation** that covers 90% of modern app requirements immediately:
- **JWT Management**: Secure token generation and handling.
- **Multi-Provider**: Unified user model whether they sign in via Email, Google, or Apple.
- **Security Flow**: Built-in logic for password resets, email verification, and audit logging (crucial for admin dashboards).

### When NOT to use it?
- If you have an extremely specific legacy database schema that cannot adapt to the `User` model structure provided (though the model is extensible).
- If you use a completely external IAM (like Auth0 or AWS Cognito) and only need your backend to verify tokens without managing users locally.

---

## Integration Guide

### 1. Extending the User Model

The `User` model is the heart of your app. It extends `UserLeafBase` which provides the core authenticatable fields. You **must** extend it in `src/models/User.ts` for your business logic.

```typescript
import { Table, Column, HasMany } from 'etherial/components/database/provider'
import { UserLeafBase } from 'etherial/leafs/ETHUserLeaf'

@Table
export class User extends UserLeafBase {
    // --- Your Business Logic ---
    @Column subscription_tier: string; // e.g., 'premium'

    @HasMany(() => Order)
    orders: Order[];
}
```

---

## Required Method Overrides

> [!IMPORTANT]
> The following methods **must be implemented** in your `User` model. They are called by the authentication routes and will do nothing by default (only `console.log`).

### Email Notifications

#### `sendEmailForPasswordReset(resetToken: string)`
Called when a user requests a password reset via `POST /auth/forgot-password`.

```typescript
async sendEmailForPasswordReset(resetToken: string): Promise<void> {
    const resetLink = `${Config.app.frontendUrl}/reset-password?token=${resetToken}`

    // Example with Resend
    await resend.emails.send({
        from: 'noreply@yourapp.com',
        to: this.email,
        subject: 'Reset your password',
        html: `
            <h1>Password Reset</h1>
            <p>Hello ${this.firstname},</p>
            <p>Click the link below to reset your password:</p>
            <a href="${resetLink}">Reset Password</a>
            <p>This link expires in 1 hour.</p>
        `
    })
}
```

#### `sendEmailForEmailVerification(confirmationToken: string)`
Called after user registration to verify their email address.

```typescript
async sendEmailForEmailVerification(confirmationToken: string): Promise<void> {
    const verifyLink = `${Config.app.frontendUrl}/verify-email?token=${confirmationToken}`

    await resend.emails.send({
        from: 'noreply@yourapp.com',
        to: this.email,
        subject: 'Verify your email',
        html: `
            <h1>Welcome ${this.firstname}!</h1>
            <p>Please verify your email by clicking the link below:</p>
            <a href="${verifyLink}">Verify Email</a>
        `
    })
}
```

#### `sendEmailForPasswordNotification(type: string)`
Called after password changes to notify the user. The `type` parameter indicates the action: `'changed'`, `'created'`, or `'reset'`.

```typescript
async sendEmailForPasswordNotification(type: string): Promise<void> {
    const messages = {
        changed: 'Your password was successfully changed.',
        created: 'A password was created for your account.',
        reset: 'Your password was reset successfully.'
    }

    await resend.emails.send({
        from: 'security@yourapp.com',
        to: this.email,
        subject: 'Password Update Notification',
        html: `
            <h1>Security Alert</h1>
            <p>Hello ${this.firstname},</p>
            <p>${messages[type] || 'Your password was updated.'}</p>
            <p>If you didn't make this change, contact support immediately.</p>
        `
    })
}
```

---

### SMS Notifications

#### `sendSmsForPhoneVerification(confirmationCode: string)`
Called when verifying a user's phone number.

```typescript
async sendSmsForPhoneVerification(confirmationCode: string): Promise<void> {
    // Example with Twilio
    await twilioClient.messages.create({
        body: `Your verification code is: ${confirmationCode}`,
        from: Config.twilio.phoneNumber,
        to: this.phone_temporary || this.phone  // phone_temporary for updates
    })
}
```

---

### OAuth Static Methods

> [!IMPORTANT]
> These **static methods** are required for Google/Apple Sign-In. They handle the "create or fetch" logic when a user authenticates via OAuth.

#### `createOrFetchUserFromGoogle(profile_id, firstname, lastname, email)`
Called by `POST /auth/google` after validating the Google token.

```typescript
static async createOrFetchUserFromGoogle(
    profile_id: string,
    firstname: string,
    lastname: string,
    email: string
): Promise<User> {
    // 1. Check if user exists by Google ID
    let user = await User.findOne({ where: { google_id: profile_id } })
    if (user) {
        return user
    }

    // 2. Check if user exists by email (linking accounts)
    user = await User.findOne({ where: { email } })
    if (user) {
        user.google_id = profile_id
        if (!user.email_confirmed) {
            user.email_confirmed = true
            user.email_confirmed_at = new Date()
        }
        await user.save()
        return user
    }

    // 3. Create new user
    return await User.create({
        google_id: googleId,
        email: email,
        firstname: given_name,
        lastname: family_name,
        username: name,
        avatar: picture,
        should_set_password: true,
        email_confirmed: true,
        email_confirmed_at: new Date(),
    })
}
```

#### `createOrFetchUserFromApple(appleId, email, firstname, lastname)`
Called by `POST /auth/apple` after validating the Apple token.

```typescript
static async createOrFetchUserFromApple(
    appleId: string,
    email: string,
    firstname: string,
    lastname: string
): Promise<User> {
    // 1. Check if user exists by Apple ID
    let user = await User.findOne({ where: { apple_id: appleId } })
    if (user) return user

    // 2. Check if user exists by email (linking accounts)
    user = await User.findOne({ where: { email } })
    if (user) {
        user.apple_id = appleId
        await user.save()
        return user
    }

    // 3. Create new user
    // Note: Apple only sends name on FIRST sign-in
    return await User.create({
        apple_id: appleId,
        firstname: firstname || 'Apple',
        lastname: lastname || 'User',
        email,
        email_confirmed: true,
        should_set_password: true
    })
}
```

---

## Available Helper Methods

The `UserLeafBase` provides these ready-to-use methods:

| Method | Description |
|--------|-------------|
| `isActive()` | Returns `true` if user is enabled and credentials haven't expired. |
| `getFullName()` | Returns `"firstname lastname"`. |
| `isConfirmationTokenValid(token)` | Validates email confirmation token. |
| `isPasswordResetTokenValid(token)` | Validates password reset token (checks expiry). |

---

## Frontend Integration (Auth Flow)

The leaf is designed to be "headless". Your frontend (React/Vue/Mobile) should handle token management.

**Typical Flow:**
1. **Login**: Call `POST /auth/email` or `POST /auth/google`.
2. **Store Token**: Save the returned JWT securely (SecureStore, HTTPOnly Cookie, etc.).
3. **Authenticated Requests**: Send `Authorization: Bearer <token>` header.
4. **401 Handling**: If you get a 401, clear the token and redirect to login.

---

## Handling "Social-to-Password"

A smart feature of this leaf is the "Social-to-Password" flow:
1. A user signs up with Google.
2. Later, they want to set a password to log in via email.
3. The UI checks `user.should_set_password`. If `true`, show a "Create Password" UI and call `POST /users/me/password`.

---

## Available Model Fields

> [!TIP]
> These fields are automatically excluded from API responses via `defaultScope`. Use `.unscoped()` for admin queries.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Primary key (auto-increment). |
| `firstname` | `string` | User's first name. |
| `lastname` | `string` | User's last name. |
| `username` | `string` | Optional username. |
| `email` | `string` | Unique email address. |
| `password` | `string` | Hashed password (nullable for OAuth users). |
| `google_id` | `string` | Google OAuth ID. |
| `apple_id` | `string` | Apple Sign-In ID. |
| `enabled` | `boolean` | Account enabled status. |
| `email_confirmed` | `boolean` | Email verification status. |
| `phone` | `string` | Primary phone number (unique). |
| `phone_verified` | `boolean` | Phone verification status. |
| `phone_temporary` | `string` | New phone awaiting verification. |
| `avatar` | `string` | Profile picture URL. |
| `metadata` | `JSON` | Custom JSON data storage. |
| `role` | `number` | User role (default: `1`). |
| `last_login` | `Date` | Last successful login timestamp. |
| `login_count` | `number` | Total successful logins. |
| `should_set_password` | `boolean` | Prompts OAuth users to set password. |
| `credentials_expired` | `boolean` | Force password change on next login. |
| `credentials_expire_at` | `Date` | Password expiry date (default: 90 days). |
| `failed_login_attempts` | `number` | Brute-force protection counter. |
| `marketing_emails_enabled` | `boolean` | Email marketing opt-in status. |
| `terms_accepted` | `boolean` | Terms of service acceptance. |
| `privacy_policy_accepted` | `boolean` | Privacy policy acceptance. |
| `bio` | `string` | User biography/description. |
| `birth_date` | `Date` | User's birth date. |
| `gender` | `string` | User's gender. |
| `deleted_at` | `Date` | Soft delete timestamp. |
| `created_at` | `Date` | Account creation timestamp. |
| `updated_at` | `Date` | Last update timestamp. |
