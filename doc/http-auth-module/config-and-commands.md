# HTTP Auth | Configuration & Commands

Security is a top priority when it comes to web application development. Etherial.TS takes security seriously and provides a comprehensive authentication system to safeguard your applications from unauthorized access. The **HTTP Auth Module** provides robust mechanisms for JWT, Basic Auth, and API Key authentication, along with flexible metadata-based access control.

---

## ⚙️ Configuration

To use the HTTP Auth component, add it to your `src/Config.ts`.

### Basic Setup

```typescript
import { HttpAuth, HttpAuthConfig } from 'etherial/components/http.auth'

{
    ...
    http_auth: {
        module: HttpAuth,
        config: {
            // Secret key used for signing JWT tokens
            secret: process.env.HTTP_AUTH_SECRET || 'CHANGE_ME_IN_PROD',
        } as HttpAuthConfig,
    },
}
```

### Environment Variables

We recommend using a `.env` file to store your secret:

```env
HTTP_AUTH_SECRET=super_secure_random_string_configured_in_env
```

### Bootstrap (`src/app.ts`)

The HTTP Auth module needs to be initialized alongside your app.

```typescript
// src/app.ts
import { HttpAuth } from 'etherial/components/http.auth'
import { User } from './models/User'

class App {
    run({ http_auth }: { http_auth: HttpAuth }) {
        
        // 1. Define how to retrieve a USER from the JWT payload
        http_auth.setAuthChecker(async ({user_id}) => {
            // payload contains the data you signed (e.g. { user_id: 1 })
            return User.findOne({
                where: {
                    id: user_id,
                },
            })
        })

        // 2. (Optional) Define how to check ROLES
        http_auth.setRoleChecker(async (user: User, requiredRole: string) => {
            // 'user' is the object returned by setAuthChecker
            return user.role === requiredRole
        })

        // ... rest of your app initialization
    }
}
```

### Configuration Interface

The `HttpAuthConfig` interface is simple and focused:

```typescript
interface HttpAuthConfig {
    secret: string // Required: The secret key for JWT signing/verification
}
```

---

## 🛠 CLI Commands

The HTTP Auth module exposes commands to assist with token management.

### `generate:token <user_id>`

Generates a valid JWT token for a specific user ID. Useful for testing or creating initial internal tokens.

```bash
# Generate a token for user with ID 1
etherial cmd generate:token 1
```

**Output:**
```
{
  "success": true,
  "message": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
