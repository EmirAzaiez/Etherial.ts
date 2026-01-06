# HTTP Auth | Usage & Integration

Security is a top priority when it comes to web application development. Etherial.TS takes security seriously and provides a comprehensive authentication system to safeguard your applications from unauthorized access. The **HTTP Auth Module** provides robust mechanisms for JWT, Basic Auth, and API Key authentication, along with flexible metadata-based access control.

---

## ⚡ Integration

Once configured, you need to tell the module **how** to find your data (Users, Roles, etc.) from the token payloads. This is usually done in your bootstrap file (e.g., `src/app.ts`).

### Setting up Checkers

You must define at least an `AuthChecker` to validate tokens and retrieve user data.

```typescript
// src/app.ts
import { HttpAuth } from 'etherial/components/http.auth'
import { User } from './models/User'

class App {
    run({ http_auth }: { http_auth: HttpAuth }) {
        
        // 1. Define how to retrieve a USER from the JWT payload
        http_auth.setAuthChecker(async (payload) => {
            // payload contains the data you signed (e.g. { user_id: 1 })
            const user = await User.findByPk(payload.user_id)
            return user ? user.toJSON() : null
        })

        // 2. (Optional) Define how to check ROLES
        http_auth.setRoleChecker(async (user, requiredRole) => {
            // 'user' is the object returned by setAuthChecker
            return user.role === requiredRole
        })

        // ... rest of your app initialization
    }
}
```

---

## 🔐 Creating Tokens

You can generate tokens anywhere in your application (typically in a Login Controller) using the `http_auth` instance.

```typescript
import etherial from 'etherial'

// Inside a controller method
const token = etherial.http_auth.generateToken({ 
    user_id: user.id,
    role: user.role 
})

// Return to client
res.success({ data: { token } })
```

---

## 🛡 protecting Routes

Etherial provides intuitive decorators to secure your Controllers or specific Routes.

### `@ShouldBeAuthenticated`

Enhances the route with JWT validation. The user is attached to `req.user`.

```typescript
import { Controller, Get, Request, Response } from "etherial/components/http/provider"
import { ShouldBeAuthenticated } from "etherial/components/http.auth/provider"

@Controller()
export default class UserController {

    @Get('/me')
    @ShouldBeAuthenticated()
    public me(req: Request, res: Response) {
        // req.user is guaranteed to be present here
        res.success({ data: req.user })
    }
}
```

### Role Based Access Control (RBAC)

Use `@ShouldBeAuthenticatedWithRole` to enforce specific roles. This requires that you have configured `setRoleChecker` in your app.

```typescript
import { ShouldBeAuthenticatedWithRole } from "etherial/components/http.auth/provider"

@Controller('/admin')
export class AdminController {

    @Get('/stats')
    @ShouldBeAuthenticatedWithRole('admin')
    public stats(req: Request, res: Response) {
        // Only accessible if RoleChecker returns true for 'admin'
        res.success({ message: "Welcome Admin" })
    }
}
```

### Other Authentication Methods

Etherial also supports alternatives to simple JWT Bearer tokens:

*   **`@ShouldBeAuthenticatedWithBasicAuth(user, pass)`**: Enforces HTTP Basic Auth headers.
*   **`@ShouldBeAuthenticatedWithApiKey(key, header?)`**: Enforces a specific API Key in headers (default `x-api-key`).

```typescript
import { 
    ShouldBeAuthenticatedWithApiKey, 
    ShouldBeAuthenticatedWithBasicAuth 
} from "etherial/components/http.auth/provider"

@Get('/legacy-api')
@ShouldBeAuthenticatedWithBasicAuth('admin', 'secret123')
public legacy(req: Request, res: Response) {
    // Validates Basic Auth header matches 'admin:secret123'
    res.success({ message: "Legacy Access Granted" })
}

@Get('/webhook')
@ShouldBeAuthenticatedWithApiKey('my-secret-webhook-key')
public webhook(req: Request, res: Response) {
    // ...
}
```
