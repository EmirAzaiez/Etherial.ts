# Reactive | Configuration & Commands

The **Reactive Module** brings real-time capabilities to your Etherial application. Built on top of `socket.io`, it allows you to push data to connected clients instantly when your database models change.

Whether you need live notifications, real-time dashboards, or collaborative editing, the Reactive module integrates deeply with Sequelize to make "reactivity" a native property of your data strategy.

---

## ⚙️ Configuration

To use the Reactive component, add it to your `src/Config.ts`.

### Basic Setup

```typescript
import { Reactive, ReactiveConfig } from 'etherial/components/reactive'

{
    ...
    reactive: {
        module: Reactive,
        config: {
            // Optional: CORS settings for Socket.io
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            },
            
            // Optional: Performance tuning
            pingInterval: 25000,
            pingTimeout: 20000
        } as ReactiveConfig,
    },
}
```

### Bootstrap (`src/app.ts`)

The Reactive module needs to be initialized alongside your HTTP server.

```typescript
// src/app.ts
import { Etherial } from 'etherial'
import { Reactive } from 'etherial/components/reactive'

class App {
    run({ http, database, reactive }: Etherial) {
        
        // ... configure http and other modules ...

        return Promise.all([
            // 1. Start the Socket.IO server
            reactive.listen(),
            
            // 2. Start HTTP server
            http.listen(),
            
            // 3. Sync Database
            database.sequelize.sync({ alter: true }),
        ]);
    }
}
```

---

## 🛠 CLI Commands

*This module does not currently expose any CLI commands.*
