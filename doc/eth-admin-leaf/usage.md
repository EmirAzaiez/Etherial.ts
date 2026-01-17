# Using ETHAdminLeaf

## Built-in Features

### users
- `GET /admin/users?page=1&limit=20&q=john`

### messages  
- `GET /admin/messages?type=email&status=sent`
- `GET /admin/messages/:id`

### campaigns
- `GET /admin/campaigns`
- `GET /admin/campaigns/:id`
- `POST /admin/campaigns`
  - Body: `{ message, url?, target_logged_user, target_not_logged_user }`
  - Auto-sends push notifications to matching devices

## Custom Collections

```typescript
collections: [
    {
        name: 'app_updates',
        model: AppUpdate,
        crud: ['list', 'show', 'create', 'update', 'delete'],
        attributes: ['id', 'version', 'platform'],
        allowedFilters: ['platform'],
        search: { fields: ['version'] },
        createForm: AppUpdateForm,
        updateForm: AppUpdateForm
    }
]
```

Auto-generates:
- `GET /admin/app_updates`
- `GET /admin/app_updates/:id`
- `POST /admin/app_updates`
- `PUT /admin/app_updates/:id`
- `DELETE /admin/app_updates/:id`
