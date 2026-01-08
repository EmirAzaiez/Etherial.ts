# ETHMediaLeaf Models

## Media

Stores metadata for every file uploaded to S3.

**Table Name:** `medias`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `INTEGER` | Primary Key |
| `folder` | `STRING` | Logic folder (e.g. `avatars`) |
| `name` | `STRING` | Generated filename on S3 |
| `real_name` | `STRING` | Original filename uploaded by user |
| `key` | `STRING` | Full S3 Key (`folder/name`) |
| `mime_type` | `STRING` | e.g., `image/jpeg` |
| `file_size` | `INTEGER` | Size in bytes |
| `status` | `ENUM` | `pending` (0), `uploaded` (1), `error` (2) |
| `visibility` | `STRING` | `public-read` or `private` |
| `uploaded_by` | `INTEGER` | Foreign Key (User) |
| `created_at` | `DATE` | Upload timestamp |

### Status Lifecycle
1.  **Pending (0)**: `requestUpload` called. S3 key reserved.
2.  **Uploaded (1)**: `confirmUpload` called. File verified in S3.
3.  **Error (2)**: Upload failed or timed out (cleaned up by cron).
