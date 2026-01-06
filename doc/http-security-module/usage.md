# HTTP Security | Usage & Protection

In modern web development, securing your application against common threats is non-negotiable. Etherial.TS provides a dedicated **HTTP Security Module** that acts as a fortress for your API. It goes beyond simple authentication (handled by the Auth module) to provide infrastructure-level protection like Rate Limiting, Brute Force protection, IP filtering, and Payload size limits.

By analyzing incoming traffic patterns, this module ensures your application remains resilient against abuse, denial-of-service attacks, and malicious automated scripts.

---

## 🚦 Rate Limiting

Controls the rate of traffic sent by a client or service.

### `@ShouldUseLimiter`
Apply custom rate limiting to specific routes.

```typescript
import { Controller, Post } from "etherial/components/http/provider"
import { ShouldUseLimiter } from "etherial/components/http.security/provider"

@Controller()
export default class AuthController {

    @Post('/auth')
    @ShouldUseLimiter({ windowMs: 60000, max: 5 }) // 5 requests per minute
    public login() {
        // ...
    }
}
```

### Predefined Limiters

*   **`@ShouldUseStrictLimiter`**: Very strict (5 req/min). Good for sensitive actions like "Forgot Password".
*   **`@ShouldUseRelaxedLimiter`**: Relaxed (100 req/min). Good for public data APIs.
*   **`@ShouldUseLimiterPerUser`**: Limits based on User ID (if authenticated) instead of IP.

---

## 🛑 IP Filtering

Allow or deny access based on IP addresses. Supports wildcards (`*`).

### `@ShouldBlockIPs`
Deny specific IPs.

```typescript
import { ShouldBlockIPs } from "etherial/components/http.security/provider"

@Get('/admin')
@ShouldBlockIPs(['1bad.ip.add.ress', '192.168.0.*'])
public adminPanel() {
    // ...
}
```

### `@ShouldAllowOnlyIPs`
Whitelist mode. Denies everyone else.

```typescript
import { ShouldAllowOnlyIPs } from "etherial/components/http.security/provider"

@Get('/internal/metrics')
@ShouldAllowOnlyIPs(['10.0.0.*', '127.0.0.1'])
public metrics() {
    // Only internal network can access
}
```

---

## 🔨 Brute Force Protection

Detects and creates increasing delays for repeated failed attempts.

### `@ShouldProtectBruteForce`
Automatically manages retry counters and delays.

```typescript
import { ShouldProtectBruteForce } from "etherial/components/http.security/provider"

@Post('/login')
@ShouldProtectBruteForce({ freeRetries: 5, minWait: 500 })
public login(req: Request, res: Response) {
    // If login fails, counter increases.
    // Use (req as any).resetBruteForce() on success!
    
    if (success) {
        (req as any).resetBruteForce()
        res.success(...)
    }
}
```

---

## 📦 Request Size Limits

Prevent DoS attacks via massive payloads.

### `@ShouldLimitSize`

```typescript
import { ShouldLimitSize } from "etherial/components/http.security/provider"

@Post('/upload')
@ShouldLimitSize(5 * 1024 * 1024) // 5MB Limit
public upload() {
    // ...
}
```

### Predefined Size Limits

*   **`@ShouldLimitTo1KB`**: Lightweight JSON.
*   **`@ShouldLimitTo100KB`**: Standard forms.
*   **`@ShouldLimitTo1MB`**: Large text/data.
*   **`@ShouldLimitTo10MB`**: File uploads.

---

## 🛡 Composite Decorators

Etherial provides "Security Stacks" for common scenarios.

### `@ShouldSecureAuthRoute`
Combines **Rate Limiting** (10 req/min) + **Brute Force Protection**.
Perfect for Login, Register, Password Reset.

```typescript
@ShouldSecureAuthRoute()
public login() {}
```

### `@ShouldSecureAPIRoute`
Combines **Rate Limiting** (60 req/min) + **Size Limit** (1MB).
Standard protection for most API endpoints.

```typescript
@ShouldSecureAPIRoute()
public createPost() {}
```
