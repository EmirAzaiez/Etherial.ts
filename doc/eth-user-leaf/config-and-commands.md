# ETHUserLeaf Configuration & Commands

## Installation

```bash
etherial leaf:add ETHUserLeaf
```

## Configuration

The module is configured in your `src/Config.ts` file.

```typescript
import { ETHUserLeafConfig } from 'resources/leafs/ETHUserLeaf/app'
import EthUserLeaf from 'resources/leafs/ETHUserLeaf/app'

export default {
    eth_user_leaf: {
        module: EthUserLeaf,
        config: {
            default_avatar: 'https://example.com/default-avatar.png',
            routes: {
                auth: ['authEmail', 'authUsername'],
                auth_google: ['authGoogle'],
                auth_apple: ['authApple'],
                users: ['updateUserMeBio', 'updateUserMeAvatar'],
                users_password: [
                    'userUpdatePassword', 
                    'setUserPassword', 
                    'requestPasswordReset', 
                    'confirmPasswordReset'
                ],
                users_phone: ['sendPhoneValidation', 'confirmPhoneValidation']
            }
        } satisfies ETHUserLeafConfig
    }
}
```

### Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `JWT_SECRET` | Secret key for JWT token generation | Yes | `secret123` |
| `JWT_EXPIRES_IN` | Token expiration time | No (Default: 7d) | `7d` |
| `GOOGLE_CLIENT_ID` | Google Client ID | If using Google Auth | `123...apps.googleusercontent.com` |
| `APPLE_CLIENT_ID` | Apple Service ID | If using Apple Auth | `com.app.service` |

## Commands

No specific CLI commands are provided by this leaf.
