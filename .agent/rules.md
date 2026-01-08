# Etherial Project Rules & Standards

These rules define the coding standards, patterns, and best practices for the Etherial project. All contributors (human and AI) must adhere to these guidelines.

## 🟢 General Coding Standards

### 1. Naming Conventions (**Strict**)
*   **Models (Classes & Files)**: `PascalCase`, Uppercase first letter.
    *   Example: `User`, `Device`, `PaymentSetup`.
    *   File: `User.ts`.
*   **Database Tables**: `lower_snake_case`.
    *   Example: `users`, `device_logs`, `payment_subscriptions`.
*   **API Bodies & Forms**: `lower_snake_case`.
    *   Example: `{ "first_name": "Emir", "is_active": true }`.
    *   **Do not** use camelCase for JSON properties in requests/responses.
*   **files & directories**: `lowercase-kebab-case`.
    *   Example: `user-profile.ts`, `my-component/`.

### 2. Code Block Style
*   **Explicit Brackets**: Always use curly brackets `{}` for `if`, `for`, `while`, etc., even for single lines.
    *   ✅ `if (true) { return }`
    *   ❌ `if (true) return`
*   **"Happy Ending" Pattern**: Use early returns/guards to reduce nesting. Handle errors first, return success last.
    *   ✅
        ```typescript
        if (!user) { return res.error(...) }
        // ... heavy logic ...
        return res.success(...)
        ```

## 🏗️ Etherial Framework Specifics

### 1. HTTP Controllers & Routes
*   **Full REST**: Design APIs with strict RESTful principles.
*   **Decorators First**: Use Etherial's HTTP decorators for everything.
    *   Class: `@Controller`
    *   Methods: `@Get`, `@Post`, `@Put`, `@Delete`
    *   Validation: `@ShouldValidateYupForm`
*   **"Magic" Decorators**: **ALWAYS** prefer using magic model decorators over manual logic when doing standard CRUD.
    *   `@ShouldFindAllFromModel`
    *   `@ShouldFindOneFromModel`
    *   `@ShouldCreateFromModel`
    *   `@ShouldUpdateFromModel`
    *   `@ShouldDeleteFromModel`

### 2. Models (Sequelize)
*   All models must extend `Model`.
*   Define timestamps explicitly if needed (`timestamps: true` is default).
*   Use `lower_snake_case` for column names in the database.

### 3. Forms & Validation
*   Use `EtherialYup` from `etherial/components/http/yup.validator`.
*   **Database Checks**: Use custom extensions for robustness:
    *   `.shouldNotExistInModel(Model, 'email')` (Unique check)
    *   `.shouldExistInModel(Model, 'id')` (Foreign key check)
    *   `.shouldBeStrongPassword()`

## 📝 Documentation Reference
For detailed implementation of decorators, see `doc/http-module/decorators.md`. This file contains the "truth" for how to write controllers in this project.
