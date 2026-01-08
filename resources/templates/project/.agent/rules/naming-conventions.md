# Naming Conventions (**Strict**)

## 1. Files & Directories
*   **Case**: `kebab-case` (lowercase with hyphens).
    *   ✅ `user-profile.ts`
    *   ✅ `auth-service/`
    *   ❌ `UserProfile.ts`, `AuthService/`

## 2. Models (Classes & Files)
*   **Case**: `PascalCase` (Uppercase first letter).
*   **Rule**: Must match the class name.
    *   ✅ File: `User.ts`, Class: `User`
    *   ✅ File: `PaymentMethod.ts`, Class: `PaymentMethod`

## 3. Database
*   **Tables**: `lower_snake_case`.
    *   ✅ `users`, `user_logs`, `payment_methods`
*   **Columns**: `lower_snake_case`.
    *   ✅ `first_name`, `is_active`

## 4. API (JSON)
*   **Input/Output Keys**: `lower_snake_case`.
    *   ✅ `{ "first_name": "Emir" }`
    *   ❌ `{ "firstName": "Emir" }`
    *   **Reason**: Consistency with database columns and avoiding mapping overhead.
