# ETHMediaLeaf Configuration & Commands

## Installation

```bash
etherial leaf:add ETHMediaLeaf
```

## Configuration

The module is configured in your `src/Config.ts` file.

```typescript
import { ETHMediaLeafConfig } from 'resources/leafs/ETHMediaLeaf/app'
import EthMediaLeaf from 'resources/leafs/ETHMediaLeaf/app'

export default {
    eth_media_leaf: {
        module: EthMediaLeaf,
        config: {
            access_key_id: process.env.ETH_MEDIA_LEAF_S3_ACCESS_KEY_ID!,
            secret_access_key: process.env.ETH_MEDIA_LEAF_S3_SECRET_ACCESS_KEY!,
            region: process.env.ETH_MEDIA_LEAF_S3_REGION!,
            server: process.env.ETH_MEDIA_LEAF_S3_ENDPOINT!,
            bucket: process.env.ETH_MEDIA_LEAF_S3_BUCKET!,
            cdn_url: process.env.ETH_MEDIA_LEAF_S3_CDN_URL,
            routes: {
                media: [
                    'requestUpload',
                    'confirmUpload',
                    'getMedia',
                    'getMediaAccess',
                    'getUserMedia',
                    'deleteMedia'
                ]
            },
            rules: [
                {
                    folders: ['avatars'],
                    visibility: 'public-read',
                    max_size: 5 * 1024 * 1024,
                    mime_types: ['image/jpeg', 'image/png']
                },
                {
                    folders: ['contracts'],
                    visibility: 'private',
                    max_size: 10 * 1024 * 1024,
                    signedUrlExpiration: 3600,
                    canAccess: (req, media) => media.uploaded_by === req.user?.id
                }
            ]
        } satisfies ETHMediaLeafConfig
    }
}
```

### Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `ETH_MEDIA_LEAF_S3_ACCESS_KEY_ID` | S3 Access Key | Yes | `your-key` |
| `ETH_MEDIA_LEAF_S3_SECRET_ACCESS_KEY` | S3 Secret Key | Yes | `your-secret` |
| `ETH_MEDIA_LEAF_S3_REGION` | S3 Region | Yes | `eu-west-1` |
| `ETH_MEDIA_LEAF_S3_ENDPOINT` | S3 Endpoint URL | Yes | `https://s3...` |
| `ETH_MEDIA_LEAF_S3_BUCKET` | S3 Bucket Name | Yes | `my-bucket` |
| `ETH_MEDIA_LEAF_S3_CDN_URL` | Optional CDN/Proxy URL | No | `https://cdn...` |

## Commands

- `etherial eth_media_leaf:cors`: Configures CORS on your S3 bucket to allow all origins (*).
- `etherial eth_media_leaf:cleanup:pending`: Deletes declared uploads that were never confirmed (older than 24h).
