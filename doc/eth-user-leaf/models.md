# ETHUserLeaf Models

## User

The distinct `User` model is the core of your application. `ETHUserLeaf` provides a base `User` class with essential authentication fields, but it is designed to be extended.

**Table Name:** `users`

### Core Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | `INTEGER` | Primary Key (Auto-increment) |
| `email` | `STRING` | Unique email address |
| `username` | `STRING` | Unique username (optional) |
| `password` | `STRING` | Bcrypt hashed password |
| `firstname` | `STRING` | First Name |
| `lastname` | `STRING` | Last Name |
| `avatar` | `STRING` | URL or S3 key for avatar |
| `bio` | `TEXT` | User biography |
| `role` | `STRING` | User role (default: `user`) |

### Authentication & Security

| Field | Type | Description |
|-------|------|-------------|
| `google_id` | `STRING` | Google OAuth ID |
| `apple_id` | `STRING` | Apple OAuth ID |
| `email_confirmed` | `BOOLEAN` | True if email is verified |
| `email_confirmed_at` | `DATE` | Timestamp of verification |
| `credentials_expired` | `BOOLEAN` | Forces password reset if true |
| `credentials_expire_at` | `DATE` | Date when password expires (90 days policy) |
| `should_set_password` | `BOOLEAN` | True if user registered via social login and hasn't set a password yet |

### Phone Verification

| Field | Type | Description |
|-------|------|-------------|
| `phone` | `STRING` | Verified phone number |
| `phone_temporary` | `STRING` | Phone number pending verification |
| `phone_verification_token` | `STRING` | SMS code |
| `phone_verified` | `BOOLEAN` | True if phone is verified |

### Timestamps

| Field | Type | Description |
|-------|------|-------------|
| `created_at` | `DATE` | Creation timestamp |
| `updated_at` | `DATE` | Last update timestamp |
| `deleted_at` | `DATE` | Soft delete timestamp (Paranoid) |
