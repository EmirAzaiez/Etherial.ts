# ETHAdminLeaf - Configuration

## Config

```typescript
eth_admin_leaf: {
    module: ETHAdminLeaf,
    config: {
        // Built-in features
        users: { enabled: true, search: { fields: ['email', 'firstname'] } },
        messages: { enabled: true },
        campaigns: { enabled: true },
        
        // Custom collections
        collections: [
            {
                name: 'app_updates',
                model: AppUpdate,
                crud: ['list', 'show', 'create', 'update', 'delete'],
                attributes: ['id', 'version', 'platform'],
                createForm: AppUpdateForm,
                updateForm: AppUpdateForm
            }
        ]
    }
}
```

## Access Control

```typescript
etherial.eth_admin_leaf.setAccessChecker(async (user, { route, method }) => {
    return user.role === 'admin'
})
```

## Routes

**Built-in:**
- `GET /admin/users`
- `GET /admin/messages` / `GET /admin/messages/:id`
- `GET /admin/campaigns` / `GET /admin/campaigns/:id` / `POST /admin/campaigns`

**Collections (auto-generated):**
- `GET /admin/{name}`
- `GET /admin/{name}/:id`
- `POST /admin/{name}`
- `PUT /admin/{name}/:id`
- `DELETE /admin/{name}/:id`
