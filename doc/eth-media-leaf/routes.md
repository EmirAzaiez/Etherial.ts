# ETHMediaLeaf Routes & Forms

## Upload Flow

### `POST /medias/request`
**Method:** `requestUpload`
*Generates a pre-signed URL for direct-to-S3 upload.*

**Form Validation:** `RequestUploadForm` (Yup)
- `filename`: string | required
- `folder`: string | required
    - *Constraint:* Must match a folder defined in `Config.ts`.
- `size`: number | required
    - *Constraint:* Must be less than rule's `max_size`.
- `mime_type`: string | required
    - *Constraint:* Must be allowed by rule's `mime_types`.

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "upload_url": "https://s3.../file.jpg?Signature=...",
        "key": "avatars/uuid-file.jpg",
        "id": 123
    }
}
```

### `POST /medias/:id/confirm`
**Method:** `confirmUpload`
*Marks a pending upload as complete after the client has sent the file to S3.*
*Note: Checks if file actually exists in S3 before confirming.*

**Query Params:**
- `:id`: Media ID

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "media": { "id": 123, "status": "active", ... }
    }
}
```

## Media Access

### `GET /medias/:id`
**Method:** `getMedia`
*Get public URL or metadata.*

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "url": "https://cdn.example.com/avatars/file.jpg",
        "media": { ... }
    }
}
```

### `GET /medias/:id/access`
**Method:** `getMediaAccess`
*Get a signed URL for a private file.*

**Validation:**
- User must pass the `canAccess` check defined in `Config.ts`.

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "url": "https://s3.../private.pdf?Signature=..."
    }
}
```

## Management

### `GET /medias/me`
**Method:** `getUserMedia`
*List all files uploaded by the current user.*

**Query Params:**
- `page`: number (default 1)
- `limit`: number (default 10)
- `folder`: string (optional filter)

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "data": [{ "id": 1, ... }],
        "meta": { "total_count": 1, ... }
    }
}
```

### `DELETE /medias/:id`
**Method:** `deleteMedia`
*Delete a file from DB and S3.*

**Response (200):** ` {} `
