# The Leaf Architecture

## What is a Leaf?

In Etherial, a **Leaf** is a self-contained, reusable module that encapsulates a specific set of business logic. You can think of a Leaf as a "plugin" or a "mini-application" that you plug into your main Etherial project to instantly add complex features.

Etherial was designed effectively **around** this concept. The core framework is lightweight, while rich functionality (like User Management, Payments, Media implementation) is delivered via Leafs.

## Concept & Inspiration

If you are coming from other ecosystems, the concept might feel familiar:

- **Symfony Bundles**: A Leaf is very similar to a Symfony Bundle. It's a directory structure that can contain everything: configuration, routes, database models, services, and commands.
- **Microservices (Monolithic)**: A Leaf promotes a "Modular Monolith" architecture. You keep the simplicity of a single deployment but gain the code organization of microservices.

## Why this architecture?

Etherial was conceived from the start to solve a recurring problem in backend development: **Reinventing the wheel.**

In most projects, you always need:
1. A User system (Auth, Password Reset, Profile...)
2. A Media system (Uploads, S3, Resizing...)
3. A Payment system (Stripe, Webhooks, Invoicing...)

Instead of copying/pasting code or rewriting these for every project, Etherial encapsulates them into **Leafs**.

### Key Benefits

1.  ** encapsulation**: A Leaf contains its own Models, Routes, and Logic. It doesn't pollute your global namespace.
2.  **Plug & Play**: Installing a leaf is often as simple as `etherial leaf:add <LeafName>` and adding a few lines to your `Config.ts`.
3.  **Configurable**: Leafs expose a configuration interface (strictly typed) to adapt their behavior to your specific project needs without touching the Leaf's internal code.
4.  **Updatable**: Since the business logic is inside the Leaf, you can update the Leaf version to get bug fixes or new features for that specific domain.

## Anatomy of a Leaf

A Leaf is typically structured like this:

```
MyFeatureLeaf/
├── leaf.json           # Metadata (name, version, dependencies)
├── app.ts              # Entry point (Main class)
├── models/             # Database Models (Sequelize/TypeORM)
├── routes/             # API Endpoints
└── services/           # Business Logic
```

When you start your Etherial app, the framework loads all configured Leafs, registers their models with the Database component, mounts their routes with the HTTP component, and initializes their services.
