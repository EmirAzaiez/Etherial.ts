# ETHDeviceLeaf Models

## Device

Stores user devices and their push tokens.

**Table Name:** `devices`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `INTEGER` | Primary Key |
| `user_id` | `INTEGER` | Foreign Key (User) |
| `device` | `STRING` | Unique Device UUID |
| `platform` | `ENUM` | `1`=Web, `2`=Android, `3`=iOS |
| `push_token` | `STRING` | Expo Push Token |
| `push_token_status`| `INTEGER` | `0`=Disabled, `1`=Enabled |
| `push_token_type` | `INTEGER` | `1`=Expo, `2`=Signal |
| `locale` | `STRING` | e.g., `fr-FR` |
| `tz` | `STRING` | e.g., `Europe/Paris` |
| `brand` | `STRING` | e.g., `Apple` |
| `model` | `STRING` | e.g., `iPhone 13` |
| `os_version` | `STRING` | e.g., `15.2` |
| `app_version` | `STRING` | e.g., `1.0.3` |
| `user_agent` | `STRING` | HTTP User Agent |
| `status` | `BOOLEAN` | Active status |
| `last_activity` | `DATE` | Last time device was seen |

## DeviceNotificationLog

Logs attempts to send push notifications and their results.

**Table Name:** `devices_notification_logs`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `INTEGER` | Primary Key |
| `device_id` | `INTEGER` | Foreign Key (Device) |
| `device_token` | `STRING` | Device UUID (Snapshot) |
| `push_token` | `STRING` | Push Token (Snapshot) |
| `receipt_id` | `STRING` | Expo Receipt ID |
| `message` | `STRING` | Notification Body |
| `status` | `STRING` | `ok`, `error` |
| `error_message` | `STRING` | Detailed error if failed |

## Notification

A base model for in-app notifications (optional usage).

**Table Name:** (Abstract/Base)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `INTEGER` | Primary Key |
| `title` | `TEXT` | Notification Title |
| `is_opened` | `BOOLEAN` | Read status |
| `created_for_user_id` | `INTEGER` | Recipient |
| `created_by_user_id` | `INTEGER` | Sender |
