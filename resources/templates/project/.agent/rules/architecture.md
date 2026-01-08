---
trigger: always_on
---

# Architecture & Philosophy

## 1. The Leaf Architecture (Modular Monolith)
*   **Concept**: We strictly follow a **Modular Monolith** pattern.
*   **Rule**: Do not dump code into a global "utils" or "services" bucket. Business logic MUST reside in **Leafs** (feature modules) or strictly defined project components.
*   **Structure**: 
    *   `src/app.ts`: Application entry point.
    *   `src/models/`: Database models (business entities).
    *   `src/routes/`: Controllers and API definitions.
    *   `src/forms/`: Validation schemas (Yup).
    *   `src/services/`: Pure business logic (optional, prefers Leafs).

## 2. Configuration
*   **Centralized Config**: All configuration MUST go through `src/Config.ts`.
*   **Strict Typing**: Never use `process.env` directly in your business logic. Use the typed configuration object or inject values via the Config system.
*   **Secrets**: All secrets (API Keys, Tokens) must be environment variables, accessed via `Config.ts`.
