# Database | Configuration & Commands

In the world of modern web development, a robust and efficient database interaction layer is essential. Etherial.TS recognizes this need and places a strong emphasis on using a comprehensive and well-maintained Object-Relational Mapping (ORM) tool. This choice ensures that your database operations are not only smooth but also scalable and maintainable over time.

For our model and database layer, we have chosen to leverage the power of [Sequelize](https://github.com/sequelize/sequelize-typescript) along with TypeScript. Sequelize is a battle-tested ORM that has been maintained and refined for many years. Its TypeScript version provides type safety and ensures that your database interactions are seamless and free from runtime errors.

---

## ⚙️ Configuration

To use the Database component, add it to your `src/Config.ts`.

### Basic Setup

```typescript
import { Database, DatabaseConfig } from 'etherial/components/database'

{
    ...
    database: {
        module: Database,
        config: {
            server: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            username: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'secret',
            name: process.env.DB_NAME || 'myapp',
            dialect: 'postgres', // 'mysql' | 'postgres' | 'sqlite' | 'mariadb' | 'mssql'
            
            // Auto-load models from this directory
            models: [
                path.join(__dirname, 'models') 
            ],
            
            // Optional: Advanced settings
            secure: false, // SSL
            logging: false, // Enable SQL query logging
        } as DatabaseConfig,
    },
}
```

### Environment Variables

We recommend using a `.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=root
DB_PASSWORD=secret
DB_NAME=etherial_db
```

### Configuration Interface

The `DatabaseConfig` interface defines all available options:

```typescript
interface DatabaseConfig {
    server: string
    port: number
    name: string
    username: string
    password: string
    dialect: 'mysql' | 'postgres' | 'sqlite' | 'mariadb' | 'mssql'
    models?: any[] // Array of model classes or paths
    
    // Options
    logging?: boolean | ((sql: string) => void)
    storage?: string // For SQLite
    ssl?: boolean | { rejectUnauthorized?: boolean }
    timezone?: string
}
```

### Bootstrap (`src/app.ts`)

The Database module needs to be initialized alongside your HTTP server.

```typescript
// src/app.ts
import { Etherial } from 'etherial'

class App {
    run({ http, database }: Etherial) {
        
        // ... configure http and other modules ...

        return Promise.all([
            // Sync Database
            database.sequelize.sync({ alter: true }),
        ]);
    }
}
```

---

## 🛠 CLI Commands

The Database module exposes several CLI commands to manage your database state.

### `database:destroy`
**⚠️ DESTRUCTIVE**

Drops the database schema and recreates it from scratch. All data will be lost.

```bash
etherial cmd database:destroy
```

### `database:migrate`

Runs pending migrations to update the database schema without losing data (uses `alter: true`).

```bash
etherial cmd database:migrate
```

### `database:load:fixtures <env>`
**⚠️ DESTRUCTIVE**

Destroys the current database and reloads it with data from a fixture file.
Useful for resetting a development or testing environment.

**Usage:**
```bash
# Looks for fixtures/dev.json
etherial cmd database:load:fixtures dev
```

**Fixture File Example (`fixtures/dev.json`):**
```json
[
    {
        "model": "User",
        "data": {
            "name": "Admin User",
            "email": "admin@example.com",
            "password": "hashed_password"
        }
    }
]
```
