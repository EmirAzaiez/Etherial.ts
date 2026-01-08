# General Coding Standards

## 1. Control Flow & Style
*   **Explicit Brackets**: ALWAYS use `{}`.
    *   ✅ `if (x) { return y }`
    *   ❌ `if (x) return y`
*   **"Happy Ending" Pattern (Early Return)**:
    *   Avoid wrapping your entire function in a giant `if/else` or `try/catch` nesting.
    *   Handle errors first, return early. Keep the main logic at the root indentation level.
    *   **Right**:
        ```typescript
        if (!user) { return res.error(...) }
        // ... logic ...
        return res.success(...)
        ```

## 2. Type Safety
*   **No `any`**: Avoid `any` unless absolutely necessary. Use `unknown` or defined interfaces.
*   **Strict Null Checks**: The project runs with strict null checks. Handle `undefined` explicitly.
