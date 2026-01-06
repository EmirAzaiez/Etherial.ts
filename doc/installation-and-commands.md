# Getting Started & Core Concepts

Etherial is a **Modular Node.js Framework** designed to centralize the best tools in the ecosystem while remaining completely flexible. It uses a "Leaf" system (similar to plugins or bundles) to add features progressively.

## 🚀 Installation

Etherial is installed globally as a CLI tool.

```bash
npm install -g https://github.com/EmirAzaiez/Etherial.ts.git
```

## 🏁 Initialization

To start a new project, simply run the init command:

```bash
etherial init my-project
```

This will:
1.  Clone the base template.
2.  Install dependencies.
3.  Set up the initial project structure.

## 🧩 Modularity Concept

Etherial pushes the philosophy of **extreme modularity** to the limit.

*   **Zero Dependencies**: No component is strictly "mandatory". You can have an Etherial project with *no* database and *no* HTTP server if you wish. Every piece of logic is independent.
*   **"Everything is a Module"**: In Etherial, **EVERYTHING** is a module. Even your own application logic!
    *   This is why your project always includes an `app` module.
    *   The `app` module represents your specific business logic and ties other modules together.

## ⚙️ Configuration (`Config.ts`)

The heart of your application is `src/Config.ts`. This file registers modules and defines their configuration.

It relies heavily on **Environment Variables** (`.env`) to keep secrets safe.

### Example Structure

```typescript
import App from './app' // Your application logic (The most important module!)
import { Database } from 'etherial/components/database'
import { HttpServer } from 'etherial/components/http'

export default {
    // 0. Your Application (REQUIRED)
    // In Etherial, your app is just another module!
    app: {
        module: App,
    },

    // 1. Database Module (Optional)
    database: {
        module: Database,
        config: {
            server: process.env.DB_HOST,
            name: process.env.DB_NAME,
            // ...
        }
    },

    // 2. HTTP Module (Optional)
    http: {
        module: HttpServer,
        config: {
            port: process.env.PORT,
            // ...
        }
    },
    
    // 3. Leafs (Plugins)
    // ...
}
```

By adding or removing keys in this object, you effectively enable or disable entire sections of the framework.
