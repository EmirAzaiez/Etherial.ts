# HTTP | Config & Commands

The **HTTP Component** is a wrapper around **Express.js** that provides a structured way to build APIs with decorators, automatic routing, and response helpers.

## ⚙️ Configuration

To use the HTTP component, add it to your `src/Config.ts`.

### Basic Setup

```typescript
import { HttpServer, HttpConfig } from 'etherial/components/http'
import path from 'path'

{
    http: {
        module: HttpServer,
        config: {
            port: parseInt(process.env.HTTP_PORT || '3000'),
            
            // Directory containing your controller files
            routes: [
                path.join(__dirname, 'controllers')
            ],
            
            // Optional Settings
            cors: true, // Enable CORS with default settings
            logging: true, // Log requests to console

            bodyParser: {
                json: true,
            },
        } as HttpConfig,
    },
}
```

### Environment Variables

Recommended `.env` setup:

```env
HTTP_PORT=3000
NODE_ENV=development
```

### Configuration Interface

The `HttpConfig` interface offers extensive options:

```typescript
interface HttpConfig {
    port: number
    routes: string[] // Array of directories or files
    middlewares?: RequestHandler[]
    // Advanced Options
    host?: string
    https?: {
        key: string | Buffer
        cert: string | Buffer
        passphrase?: string
    }
    cors?: boolean | CorsOptions // Uses 'cors' package
    bodyParser?: {
        json?: boolean | { limit?: string }
        urlencoded?: boolean | { extended?: boolean; limit?: string }
        raw?: boolean | { limit?: string }
    }
    trustProxy?: boolean | string | number
    logging?: boolean | ((message: string) => void)
    healthcheck?: boolean | {
        path?: string // Default: '/healthcheck'
    }
}
```

### Bootstrap (`src/app.ts`)

The HTTP module needs to be initialized alongside your HTTP server.

```typescript
// src/app.ts
import { Etherial } from 'etherial'

class App {
    run({ http }: Etherial) {
        
        // ... configure http and other modules ...

        return Promise.all([
            // Start HTTP server
            http.listen(),
        ]);
    }
}
```

---

## 🛠 Commands

The HTTP module provides commands to inspect your API structure.

### 1. `http:routes`

Lists all registered routes, their HTTP methods, and the controller method that handles them.

```bash
etherial cmd http:routes
```

**Output Example:**
```
GET     /healthcheck → Etherial.healthcheck
GET     /users       → UserController.list
POST    /users       → UserController.create
```
