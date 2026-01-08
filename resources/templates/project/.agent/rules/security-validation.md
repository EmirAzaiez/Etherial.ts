# Security & Validation

## 1. Strict Validation
*   **Input Validation**: NEVER trust user input.
*   **Tool**: Use `@ShouldValidateYupForm(Schema)` on EVERY endpoint that accepts input.
*   **Database Checks inside Validation**: Use the custom EtherialYup extensions:
    *   `.shouldNotExistInModel(User, 'email')` -> Use this for Registrations.
    *   `.shouldExistInModel(Category, 'id')` -> Use this for Relations/Foreign Keys.
    *   Do not write manual DB queries inside the controller just to check if an ID exists. Let the Validator handle it gracefully.

## 2. Authentication
*   **State**: The backend is stateless. Rely on `req.user` populated by the JWT middleware.
*   **Protection**: Use `canAccess` hooks in Magic Decorators or strict Middleware for manual routes.
