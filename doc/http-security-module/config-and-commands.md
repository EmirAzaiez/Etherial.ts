# HTTP Security | Configuration & Commands

In modern web development, securing your application against common threats is non-negotiable. Etherial.TS provides a dedicated **HTTP Security Module** that acts as a fortress for your API. It goes beyond simple authentication (handled by the Auth module) to provide infrastructure-level protection like Rate Limiting, Brute Force protection, IP filtering, and Payload size limits.

By analyzing incoming traffic patterns, this module ensures your application remains resilient against abuse, denial-of-service attacks, and malicious automated scripts.

---

## ⚙️ Configuration

To use the HTTP Security component, add it to your `src/Config.ts`.

### Basic Setup

```typescript
import { HttpSecurity, HttpSecurityConfig } from 'etherial/components/http.security'

{
    ...
    http_security: {
        module: HttpSecurity,
        config: {
            // 1. Global Rate Limiting (optional)
            rateLimit: {
                windowMs: 15 * 60 * 1000, // 15 minutes
                max: 100, // limit each IP to 100 requests per windowMs
                message: "Too many requests, please try again later"
            },

            // 2. Request Size Limits
            maxRequestSize: 10 * 1024 * 1024, // 10MB global limit

            // 3. Brute Force Settings (optional defaults)
            bruteForce: {
                freeRetries: 5,
                minWait: 500,
                maxWait: 60000,
                lifetime: 3600
            },

            // 4. IP Filtering (optional global filter)
            ipFilter: {
                blacklist: ['1.2.3.4'],
                whitelist: [], // Empty means all allowed except blacklisted
                trustProxy: true
            },
            
            // 5. Logging
            logging: true
        } as HttpSecurityConfig,
    },
}
```

### Configuration Interface

The `HttpSecurityConfig` gives you fine-grained control over all protection layers:

```typescript
export interface HttpSecurityConfig {
    // Rate Limiting
    rateLimit?: RateLimitConfig | false

    // IP Filtering
    ipFilter?: IPFilterConfig

    // Brute Force Protection
    bruteForce?: BruteForceConfig | false

    // Request Size Limit (in bytes)
    maxRequestSize?: number

    // Log security events
    logging?: boolean | ((event: SecurityEvent) => void)
}
```

#### Detailed Sub-Configs

**RateLimitConfig**
```typescript
interface RateLimitConfig {
    windowMs: number           // Time window in milliseconds
    max: number                // Max requests per window
    message?: string           // Custom error message
    statusCode?: number        // HTTP status code (default: 429)
    skip?: (req: Request) => boolean // Skip certain requests
}
```

**BruteForceConfig**
```typescript
interface BruteForceConfig {
    freeRetries?: number       // Free attempts before penalty
    minWait?: number           // Min wait time (ms)
    maxWait?: number           // Max wait time (ms)
    lifetime?: number          // Time before reset (s)
}
```

---

## 🛠 CLI Commands

*This module does not currently expose any CLI commands. All security policies are enforcing in real-time via middleware.*
