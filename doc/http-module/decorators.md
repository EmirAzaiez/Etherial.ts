# HTTP Module Decorators Reference

This is the **complete reference** for all decorators available in the `http-module`. It includes detailed parameters, code examples, and response structures.

---

## 🟢 Core Decorators

### `@Controller(prefix?, options?)`
Registers a class as a controller. All routes inside are prefixed.

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `prefix` | `string` | **Optional** | URL prefix for all routes (e.g., `'/users'`). |
| `options` | `ControllerOptions` | **Optional** | Additional configuration like middleware. |

**Example:**
```typescript
@Controller({
    prefix: '/admin',
    middlewares: [AdminMiddleware]
})
export class AdminController {}
```

---

### HTTP Methods (`@Get`, `@Post`, etc.)
Registers a method as a route handler.

**Decorators:** `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`, `@Options`, `@Head`, `@All`

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `path` | `string` | **Required** | The route path (e.g., `'/'`, `'/:id'`). |

**Example:**
```typescript
@Get('/:id')
getUser(req: Request, res: Response) { ... }
```

---

## 🛡️ Middleware & Validation

### `@Middleware(handler)`
Applies Express middleware(s) to a specific route.

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `handler` | `RequestHandler \| RequestHandler[]` | **Required** | Middleware functions. |

**Example:**
```typescript
@Get('/secret')
@Middleware(AuthMiddleware)
getSecret() { ... }
```

### `@ShouldValidateYupForm(schema, location?)`
Validates request data against a Yup schema. Returns `400 Bad Request` if validation fails.

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `schema` | `Yup.Schema` | **Required** | - | The Yup schema to validate against. |
| `location` | `'body' \| 'query' \| 'params'` | **Optional** | `'body'` | Which part of the request to validate. |

**Example:**
```typescript
@Post('/')
@ShouldValidateYupForm(CreateUserForm)
create(req: Request) { 
    // req.form is now typed and validated
}
```

---

## ✨ Magic CRUD Decorators

These decorators **automatically implement** the method logic. You do NOT need to write code inside the method body.

### Common Types
*   **`CanAccessFn`**: `(req, record?) => boolean | Promise<boolean>`
*   **`WhereFn`**: `(req) => object | Promise<object>` (Standard Sequelize Where Options)

---

### `@ShouldFindAllFromModel(Model, options)`
Standard list endpoint with pagination, filtering, searching, and sorting.

| Option | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `paramName` | `string` | **Optinal** | - | Query parameter name (e.g., `'q'`) used by search. |
| `attributes` | `string[]` | **Optional** | `All` | Specific database columns to return. |
| `include` | `any[]` | **Optional** | `[]` | Related models to join. |
| `defaultLimit` | `number` | **Optional** | `20` | Default items per page. |
| `maxLimit` | `number` | **Optional** | `100` | Maximum items per page. |
| `allowedFilters` | `string[]` | **Optional** | `[]` | Query params allowed for key-value filtering. |
| `defaultOrder` | `Array` | **Optional** | `[]` | Default sorting (e.g. `[['createdAt', 'DESC']]`). |
| `search` | `SearchConfig` | **Optional** | - | Config for full-text search. |
| `canAccess` | `CanAccessFn` | **Optional** | - | Authorization hook. |
| `whereFn` | `WhereFn` | **Optional** | - | Custom filter hook. |

**Example:**
```typescript
@Get('/')
@ShouldFindAllFromModel(User, {
    paramName: 'q',
    allowedFilters: ['role'],
    attributes: ['id', 'email']
})
list() {} 
```

**Return (200):**
```json
{
    "status": 200,
    "data": [ { "id": 1, "email": "user@example.com" } ],
    "count": 50
}
```

---

### `@ShouldFindOneFromModel(Model, options)`
Fetches a single record by ID.

| Option | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `paramName` | `string` | **Required** | The route parameter holding the ID (e.g., `'id'`). |
| `attributes` | `string[]` | **Optional** | Specific columns to return. |
| `include` | `any[]` | **Optional** | Related models to join. |
| `canAccess` | `CanAccessFn` | **Optional** | Authorization check. |
| `whereFn` | `WhereFn` | **Optional** | Extra static filter. |

**Example:**
```typescript
@Get('/:id')
@ShouldFindOneFromModel(User, { paramName: 'id' })
getOne() {}
```

**Return (200):**
```json
{
    "status": 200,
    "data": { "id": 1, "email": "user@example.com" }
}
```

---

### `@ShouldCreateFromModel(Model, options)`
Creates a new record from request body. Use with validator.

| Option | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `paramName` | `string` | **Required** | (Legacy) Pass an empty string or description. |
| `canAccess` | `CanAccessFn` | **Optional** | Authorization check. |

**Example:**
```typescript
@Post('/')
@ShouldValidateYupForm(UserForm)
@ShouldCreateFromModel(User, { paramName: '' })
create() {}
```

**Return (201):**
```json
{
    "status": 201,
    "data": { "id": 1, "email": "new@example.com" }
}
```

---

### `@ShouldUpdateFromModel(Model, options)`
Updates an existing record by ID.

| Option | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `paramName` | `string` | **Required** | Route param for ID. |
| `canAccess` | `CanAccessFn` | **Optional** | Authorization check. |

**Example:**
```typescript
@Put('/:id')
@ShouldValidateYupForm(UserUpdateForm)
@ShouldUpdateFromModel(User, { paramName: 'id' })
update() {}
```

**Return (200):**
```json
{
    "status": 200,
    "data": { "id": 1, "email": "updated@example.com" }
}
```

---

### `@ShouldDeleteFromModel(Model, options)`
Deletes a record by ID.

| Option | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `paramName` | `string` | **Required** | Route param for ID. |
| `soft` | `boolean` | **Optional** | Use soft-delete if supported (default: false). |
| `canAccess` | `CanAccessFn` | **Optional** | Authorization check. |

**Example:**
```typescript
@Delete('/:id')
@ShouldDeleteFromModel(User, { paramName: 'id' })
delete() {}
```

**Return (200):**
```json
{
    "status": 200,
    "data": { "deleted": true, "id": "1" }
}
```

---

## 🚀 Advanced Decorators

### `@ShouldSearchInModel(Model, options)`
Dedicated endpoint for searching.

| Option | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `paramName` | `string` | **Required** | Query param for search term. |
| `fields` | `string[]` | **Required** | Database fields to search against. |
| `attributes` | `string[]` | **Optional** | Columns to return. |
| `canAccess` | `CanAccessFn` | **Optional** | Authorization check. |

**Example:**
```typescript
@Get('/search')
@ShouldSearchInModel(User, {
    paramName: 'q',
    fields: ['username', 'bio']
})
search() {}

// Call: GET /search?q=something
```

**Return (200):**
```json
{
    "status": 200,
    "data": [...],
    "count": 5,
    "message": "Found 5 results for \"something\""
}
```

---

### `@ShouldToggleInModel(Model, options)`
Toggles a boolean field.

| Option | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `paramName` | `string` | **Required** | Route param for ID. |
| `field` | `string` | **Required** | Boolean field to toggle. |
| `attributes` | `string[]` | **Optional** | Attributes to reload after toggle. |

**Example:**
```typescript
@Post('/:id/toggle-active')
@ShouldToggleInModel(User, {
    paramName: 'id',
    field: 'isActive'
})
toggle() {}
```

**Return (200):**
```json
{
    "status": 200,
    "data": { "id": 1, "isActive": true },
    "message": "isActive toggled from false to true"
}
```

---

### `@ShouldFindByFieldInModel(Model, options)`
Finds a record using a non-ID field.

| Option | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `paramName` | `string` | **Required** | Route param name (e.g. `'slug'`). |
| `field` | `string` | **Required** | Database field to match (e.g. `'slug'`). |
| `canAccess` | `CanAccessFn` | **Optional** | Authorization check. |

**Example:**
```typescript
@Get('/by-slug/:slug')
@ShouldFindByFieldInModel(Article, {
    paramName: 'slug',
    field: 'slug'
})
getBySlug() {}
```

**Return (200):**
```json
{
    "status": 200,
    "data": { "id": 1, "slug": "my-article", ... }
}
```

---

### `@ShouldUpdateFieldInModel(Model, options)`
Updates exactly one field.

| Option | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `paramName` | `string` | **Required** | Route param for ID. |
| `field` | `string` | **Required** | Field to update. |
| `allowedValues`| `any[]` | **Optional** | Whitelist of valid values. |
| `canAccess` | `CanAccessFn` | **Optional** | Authorization check. |

**Example:**
```typescript
@Patch('/:id/status')
@ShouldUpdateFieldInModel(Order, {
    paramName: 'id',
    field: 'status',
    allowedValues: ['pending', 'shipped']
})
updateStatus() {}
```

**Return (200):**
```json
{
    "status": 200,
    "data": { "id": 1, "status": "shipped" },
    "message": "status updated from \"pending\" to \"shipped\""
}
```

---

## 🪄 Extended Yup Validation

| Method | Params | Description |
| :--- | :--- | :--- |
| `shouldNotExistInModel` | `(model, column)` | Fails if value **already exists** in DB (e.g. unique email). |
| `shouldExistInModel` | `(model, column)` | Fails if value **does not exist** in DB. |
| `shouldMatchField` | `(fieldName)` | Fails if value doesn't match another field. |
| `shouldBeStrongPassword`| `()` | Enforces strong password rules. |
