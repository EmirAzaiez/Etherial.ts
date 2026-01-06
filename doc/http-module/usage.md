# HTTP | Usage & Reference

In Etherial, the HTTP module leverages **Express.js** to handle requests but introduces a robust layer of **Controllers** and **Decorators** to organize logic and automate repetitive tasks.

---

## 🎮 Controllers & Routing

Controllers are classes that group related route handlers. They should be stored in your defined `routes` directory (e.g., `src/routes/` or `src/controllers/`).

### Creating a Controller

Use the `@Controller` decorator to define a class as a controller. You can define a global prefix for all routes within it.

```typescript
import { Controller, Get, Post, Request, Response } from "etherial/components/http/provider";

@Controller() // All routes will start with /users
export default class UserController {
    
    @Get('/users') // Maps to GET /users/
    public list(req: Request, res: Response) {
        res.success({ status: 200, data: [] });
    }
}
```

### Route Decorators

Etherial provides decorators for all standard HTTP verbs.

| Decorator | Description |
| :--- | :--- |
| `@Get(path)` | Handle GET requests |
| `@Post(path)` | Handle POST requests |
| `@Put(path)` | Handle PUT requests |
| `@Patch(path)` | Handle PATCH requests |
| `@Delete(path)` | Handle DELETE requests |
| `@All(path)` | Handle ALL requests |

### Middleware Integration

You can easily integrate any Express middleware using the `@Middleware` decorator (or aliases like `@ShouldUseMiddleware`).

```typescript
import { Middleware } from "etherial/components/http/provider";
import { isAdmin } from "../middlewares/auth";

@Controller('/admin')
export default class AdminController {

    @Get('/stats')
    @Middleware(isAdmin)
    public stats(req: Request, res: Response) {
        // ...
    }
}
```

### Request & Response Helpers

Etherial extends the standard Express objects with useful helpers.

| Object | Helper | Description |
| :--- | :--- | :--- |
| **Response** | `res.success(payload)` | Standardized success JSON. Payload: `{ status, data, message, count }`. |
| **Response** | `res.error(payload)` | Standardized error JSON. Payload: `{ status, errors, message }`. |
| **Request** | `req.user` | Access the authenticated user (populated by middleware). |
| **Request** | `req.form` | Access validated data (populated by `@ShouldValidateYupForm`). |

---

## 🪄 CRUD Decorators (Deep Dive)

A standout feature of Etherial is the ability to auto-generate CRUD endpoints for Sequelize models using decorators.

**Common Types:**
*   `CanAccessFn`: `(req, record?) => boolean | Promise<boolean>`
*   `WhereFn`: `(req) => Object | Promise<Object>` (Additional SQL conditions)

### 1. FindAll
`@ShouldFindAllFromModel(Model, Options)` generates a paginated list endpoint.

| Option | Type | Description |
| :--- | :--- | :--- |
| `attributes` | `string[]` | Columns to select. |
| `include` | `any[]` | Relations to eager load. |
| `allowedFilters` | `string[]` | Query params allowed for filtering (e.g. `?role=admin`). |
| `search` | `{ fields: string[] }` | Enable search: `?q=term` searches in specified fields. |
| `canAccess` | `CanAccessFn` | Authorization check. |

### 2. FindOne
`@ShouldFindOneFromModel(Model, Options)` gets a single record by ID.

| Option | Type | Description |
| :--- | :--- | :--- |
| `paramName` | `string` | **Required**. Route param for ID (e.g., `'id'`). |
| `include` | `any[]` | Relations to eager load. |
| `canAccess` | `CanAccessFn` | Auth check (receives found record). |

### 3. Create
`@ShouldCreateFromModel(Model, Options)` creates a record from `req.form` (or body).

| Option | Type | Description |
| :--- | :--- | :--- |
| `canAccess` | `CanAccessFn` | Authorization check. |

### 4. Update
`@ShouldUpdateFromModel(Model, Options)` updates a record by ID.

| Option | Type | Description |
| :--- | :--- | :--- |
| `paramName` | `string` | **Required**. Route param for ID. |
| `canAccess` | `CanAccessFn` | Auth check (receives record). |

### 5. Delete
`@ShouldDeleteFromModel(Model, Options)` deletes a record by ID.

| Option | Type | Description |
| :--- | :--- | :--- |
| `paramName` | `string` | **Required**. Route param for ID. |
| `soft` | `boolean` | Use soft delete (requires paranoid model). |
| `canAccess` | `CanAccessFn` | Auth check. |

---

## 🚀 Advanced Decorators

For more specific use cases beyond standard CRUD.

*   **`@ShouldSearchInModel`**: Dedicated search endpoint.
    *   *Usage*: `@ShouldSearchInModel(User, { fields: ['username', 'email'] })`
*   **`@ShouldToggleInModel`**: Toggle a boolean field (e.g., `isActive`).
    *   *Usage*: `@ShouldToggleInModel(User, { field: 'isActive', paramName: 'id' })`
*   **`@ShouldFindByFieldInModel`**: Find by unique field (e.g., slug).
    *   *Usage*: `@ShouldFindByFieldInModel(Post, { field: 'slug', paramName: 'slug' })`
*   **`@ShouldUpdateFieldInModel`**: Update a single field with validation.
    *   *Usage*: `@ShouldUpdateFieldInModel(Order, { field: 'status', allowedValues: ['shipped'] })`

---

## 🏆 Best Practices

To ensure your API remains clean and maintainable, follow these RESTful design principles within Etherial.

### 1. HTTP Verbs
Respect the semantics of HTTP verbs:
*   **GET**: Retrieve data (safe, idempotent).
*   **POST**: Create resources.
*   **PUT**: Update/Replace resources.
*   **DELETE**: Remove resources.

### 2. URL Structure
*   **Resource-Centric**: Use nouns, not verbs.
    *   ✅ `/users`
    *   ❌ `/getUsers`, `/create-user`
*   **Hierarchy**: Express relationships.
    *   `/users/{userId}/posts` (Posts belonging to a user)
*   **IDs**: Use identifiers for specific resources.
    *   `/users/123`
    *   Always protect your id with (\\d+) to prevent injection attacks

### 3. Thin Controllers
Keep logic in your **Models** or **Services**. Controllers should primarily handle request parsing, calling logic, and sending responses. When using Etherial's CRUD decorators, your controller methods can often be completely empty!
