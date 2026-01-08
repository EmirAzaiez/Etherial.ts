# Etherial Framework Specifics

## 1. HTTP & Controllers
*   **REST Principles**: Adhere strictly to REST verbs (`GET` for retreval, `POST` for creation, `PUT` for full update, `PATCH` for partial update, `DELETE` for removal).
*   **Decorators**: Use the `@Controller`, `@Get`, `@Post` decorators. Never code plain Express routes manually.

## 2. The "Magic" Decorators vs. Manual Logic
This is a critical distinction. Know when to use which.

### ✅ WHEN TO USE MAGIC DECORATORS
Use `@ShouldFindAllFromModel`, `@ShouldCreateFromModel`, etc. when:
*   Standard CRUD operations.
*   Simple filtering/searching/sorting requirements.
*   No complex side effects (sending emails *after* save can arguably belong in Model Hooks (Sequelize Hooks), but complex logic should be manual).
*   **Rule**: If your controller method is just fetching data and returning it, **DELETE THE CODE and use a decorator.**

### ❌ WHEN TO USE MANUAL CONTROLLERS
Write a custom controller method when:
*   You need to aggregate data from multiple sources/models heavily.
*   You are calling external 3rd party APIs (Stripe, OpenAI) as part of the request.
*   You need complex transaction management across multiple unrelated records.

## 3. Models (Data Layer)
*   **Sequelize**: We use Sequelize-Typescript.
*   **Extending**: When using Leafs (like `ETHUserLeaf`), standard practice is to **extend** the base model provided by the leaf if you need custom relationships.
