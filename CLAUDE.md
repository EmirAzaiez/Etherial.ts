# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Etherial?

Etherial is a **homemade TypeScript framework** that wraps and unifies popular Node.js libraries (Express, Sequelize, Socket.io, etc.) into a highly malleable system. It's not a traditional framework - it's an orchestration layer that makes these battle-tested libraries work together seamlessly.

**The core philosophy**: Build once, reuse everywhere. Instead of rewriting common features for each project, Etherial uses **Leafs** - pre-built, pluggable behaviors that can be added to any application:

- **Media Leaf** - File/media management
- **Admin Leaf** - Admin panel functionality
- **Payment Leaf** - Payment processing
- **Pulse Leaf** - Real-time communication
- **Users Leaf** - User management & authentication

Leafs encapsulate complex functionality into reusable modules, so you write the logic once and drop it into any Etherial-powered app.

## Build Commands

```bash
npm run build    # Compile TypeScript to dist/
npm run dev      # Watch mode for development
```

## CLI Commands

The framework provides a CLI accessible via `etherial`:
- `etherial init` - Initialize a new project
- `etherial leaf:add/update/list/remove` - Manage Leafs (plugins)
- `etherial cmd` - Run module commands (e.g., `database:migrate`, `http_auth:generate:token`)

## Architecture

Etherial is a modular TypeScript framework built on Express, Sequelize, and Socket.io.

### Core Pattern: Module Lifecycle

All modules implement `IEtherialModule` with three lifecycle phases:
1. `beforeRun()` - Initialize components (runs in parallel)
2. `run()` - Start services (runs in parallel)
3. `afterRun()` - Post-startup setup (runs in parallel)

### Components (`src/components/`)

- **HTTP** - Express wrapper with decorator-based routing (`@Controller`, `@Get`, `@Post`, etc.)
- **Database** - Sequelize wrapper with model registration and fixtures
- **HttpAuth** - JWT authentication and middleware
- **HttpSecurity** - Rate limiting, IP filtering, brute force protection
- **Reactive** - Socket.io integration for real-time communication

### Leafs (`src/leafs/`)

Leafs are the heart of Etherial's reusability. Each Leaf is a self-contained feature module that can be dropped into any Etherial app. A Leaf can include:
- Routes and controllers
- Database models
- CLI commands
- Middleware and validators

When building a new Leaf, design it to be generic enough for any project but specific enough to solve a real problem (media handling, payments, user auth, etc.).

## Coding Standards

### Naming Conventions
- **Models/Classes**: `PascalCase` (e.g., `User`, `PaymentSetup`)
- **Database tables**: `lower_snake_case` (e.g., `users`, `device_logs`)
- **API bodies/forms**: `lower_snake_case` (e.g., `{ "first_name": "..." }`)
- **Files/directories**: `lowercase-kebab-case` (e.g., `user-profile.ts`)

### Code Style
- Always use explicit brackets `{}` for control flow, even single lines
- "Happy Ending" pattern: early returns for errors, success at the end
- Use decorators for HTTP routes, never manual route registration

### HTTP Controllers

Use magic decorators for CRUD operations:
```typescript
@ShouldFindAllFromModel    // GET all
@ShouldFindOneFromModel    // GET one
@ShouldCreateFromModel     // POST
@ShouldUpdateFromModel     // PUT
@ShouldDeleteFromModel     // DELETE
```

### Validation

Use `EtherialYup` from `etherial/components/http/yup.validator`:
```typescript
.shouldNotExistInModel(Model, 'field')  // Unique check
.shouldExistInModel(Model, 'field')     // FK check
.shouldBeStrongPassword()
```

### Response Format

Always use custom response helpers:
```typescript
res.success({ data, count?, message? })
res.error({ errors, message? })
```
