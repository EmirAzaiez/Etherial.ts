# Using ETHMediaLeaf

## Strategy: Why & When?

### Why use this Leaf?
Storing files in your local server storage is a recipe for disaster (no scaling, detailed backups needed). `ETHMediaLeaf` forces you into the **S3-compatible** pattern (AWS, MinIO, DigitalOcean Spaces, Scaleway Object Storage).

It handles the complex part: **Pre-signed URLs**.
Instead of uploading the file to your server (blocking your Node.js thread) and then pushing to S3, the client asks for a "permission slip" (signed URL) and uploads directly to S3. This is infinitely scalable.

### When NOT to use it?
- If you absolutely must store files on the local disk (e.g. invalid requirement).
- If you use a specialized hosting service like Cloudinary or Uploadcare that handles everything via its own widget/SDK.

## Integration Guide

### 1. Configuration (Access Rights)
The power of this leaf is in `src/Config.ts`. Define folders as "buckets" of logic.

```typescript
{
    // Public files (Avatars, Blog headers)
    folders: ['public'],
    visibility: 'public-read',
},
{
    // Private files (Invoices, IDs)
    folders: ['invoices'],
    visibility: 'private',
    // Logic inside configuration, not scattered in controllers
    canAccess: (req, media) => {
        return media.uploaded_by === req.user?.id || req.user?.is_admin
    }
}
```

### 2. Frontend Upload Flow

**Step 1:** Ask permission.
```javascript
const { data } = await api.post('/medias/request', {
    filename: file.name,
    folder: 'avatars',
    size: file.size,
    mime_type: file.type
});
// data.upload_url, data.id
```

**Step 2:** Upload to S3 (PUT).
```javascript
await fetch(data.upload_url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type }
});
```

**Step 3:** Confirm to Backend.
```javascript
await api.post(`/medias/${data.id}/confirm`);
```

### 3. Displaying Images
For public files, just use the `url` returned by `getMedia` (which points to your CDN).
For private files, call `getMediaAccess` to get a temporary URL (valid for 1 hour by default) and put that in your `src=""`.
