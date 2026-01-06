# Reactive | Usage & Integration

The **Reactive Module** brings real-time capabilities to your Etherial application. Built on top of `socket.io`, it allows you to push data to connected clients instantly when your database models change.

Whether you need live notifications, real-time dashboards, or collaborative editing, the Reactive module integrates deeply with Sequelize to make "reactivity" a native property of your data strategy.

---

## 🔌 Making Models Reactive

The core of this module is the `@ReactiveTable` decorator. It replaces the standard `@Table` decorator from `sequelize-typescript` and adds real-time hooks.

### Basic Usage

```typescript
import { Model, Column, DataType, AutoIncrement, PrimaryKey } from "etherial/components/database/provider";
import { ReactiveTable, ReactiveHookType } from "etherial/components/reactive/provider"

@ReactiveTable({
    tableName: "notifications",
    // Define what happens on CRUD events
    reactive: ({ onCreate }) => {
        // When a record is created...
        onCreate((instance) => ({
            // ...send it to all connected users
            rooms: ["users"] 
        }));
    }
})
export class Notification extends Model {
    @AutoIncrement
    @PrimaryKey
    @Column
    id: number;
    
    @Column
    message: string;
}
```

Now, whenever you do `Notification.create(...)`, a socket event is emitted to all authenticated users!

### Reactive Hooks

You can hook into `onCreate`, `onUpdate`, and `onDelete`. The callback function expects you to return a **Target Configuration**:

```typescript
interface TargetConfig {
    rooms?: string[]        // Send to specific rooms (e.g. "room_1", "all", "guests")
    users?: (string|number)[] // Send to specific user IDs
    skip?: boolean          // Don't emit anything
    instance?: Model        // (Optional) Override the data being sent
}
```

#### Example: Targeted Updates

```typescript
@ReactiveTable({
    tableName: "messages",
    reactive: ({ onCreate, onUpdate }) => {
        
        // 1. New Message: Send to the recipient only
        onCreate((msg) => ({
            users: [msg.recipientId]
        }))

        // 2. Updated Message: Broadcast to the conversation room
        onUpdate((msg) => ({
            rooms: [`conversation_${msg.conversationId}`]
        }))
    }
})
class Message extends Model { ... }
```

---

## 📡 Client Side Integration

To consume these events in your frontend, you need a Socket.IO client.

### Events Format

Etherial emits a standard event named `reactive`.

**Payload Structure:**
```json
{
  "action": "create" | "update" | "delete",
  "model": "Notification", 
  "data": { "id": 1, "message": "Hello" },
  "timestamp": 1678888888
}
```

### Vanilla JS Example

```html
<script src="/socket.io/socket.io.js"></script>
<script>
  const socket = io("http://your-api.com");

  // 1. Authenticate (Required to receive user-specific events)
  socket.emit("auth", "YOUR_JWT_TOKEN");

  // 2. Listen for changes
  socket.on("reactive", (payload) => {
      console.log(`New event on ${payload.model}:`, payload.data);
  });
</script>
```

### React Example (with Hook)

We recommend creating a `useSocket` hook to manage the connection.

```typescript
// useSocket.ts
import { useState, useEffect } from "react";
import io, { Socket } from "socket.io-client";

let socket: Socket;

// Singleton to reuse connection
export const getSocket = () => {
    if (!socket) {
        socket = io("http://your-api.com");
    }
    return socket;
};

export const useSocket = (onReactive?: (event: any) => void) => {
    const [socketInstance] = useState(getSocket());

    useEffect(() => {
        if (onReactive) {
            socketInstance.on("reactive", onReactive);
            return () => {
                socketInstance.off("reactive", onReactive);
            };
        }
    }, [onReactive]);

    const authenticate = (token: string) => {
        socketInstance.emit("auth", token);
    };

    return { socket: socketInstance, authenticate };
};
```

**Usage in Component:**

```typescript
const MyComponent = () => {
    useSocket((event) => {
        if (event.model === "Notification" && event.action === "create") {
            alert(`New Notification: ${event.data.message}`);
        }
    });

    return <div>Start your engines...</div>;
};
```
