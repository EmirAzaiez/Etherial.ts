# HTTP | Form Validation (Yup)

Etherial integrates **Yup** for request validation. It provides a dedicated decorator and powerful custom extensions to interact with the database directly during validation.

## 🛡 Validating Requests

Use the `@ShouldValidateYupForm` decorator to validate `req.body`, `req.query`, or `req.params`.

When validation succeeds:
1.  The validated (and cleaned) data is available in `req.form`.
2.  Any database records fetched during validation (using helpers like `shouldExistInModel`) are injected into `req.form` automatically.

If validation fails, a `400 Bad Request` is returned with formatted errors.

### 📍 Validation Location & Multiple Forms

The decorator accepts a second argument to specify the data source: `'body'` (default), `'query'`, or `'params'`.
You can validate multiple sources on the same route.

```typescript
@Post('/:id')
@ShouldValidateYupForm(ParamSchema, 'params') // Validates req.params
@ShouldValidateYupForm(BodySchema, 'body')    // Validates req.body
update(req: Request, res: Response) { 
    // ... 
}
```

### 🤝 Integration with CRUD

Validated data is stored in `req.form`. The `@ShouldCreateFromModel` and `@ShouldUpdateFromModel` decorators automatically use `req.form` if available, making the integration seamless.

1.  **Validate** incoming data (and check DB existence).
2.  **Create/Update** model using the clean data.

```typescript
@Post('/')
@ShouldValidateYupForm(UserSchema)
@ShouldCreateFromModel(User, { ... }) // Uses req.form!
create() {}
```

### Basic Usage

```typescript
import { Controller, Post } from 'etherial/components/http/provider'
import { ShouldValidateYupForm, EtherialYup as yup } from 'etherial/components/http/yup.validator'

// Define Schema
const CreateUserSchema = yup.object().shape({
    email: yup.string().email().required(),
    password: yup.string().min(8).required(),
    age: yup.number().min(18)
})

@Controller()
export default class UserController {

    @Post('/users')
    @ShouldValidateYupForm(CreateUserSchema)
    create(req: Request, res: Response) {
        // Safe to use req.form here
        const { email, password } = req.form
        // ...
    }
}
```

---

## ⚡️ Etherial Yup Extensions

Etherial adds custom methods to Yup to handle common database checks easily.

### `shouldNotExistInModel(Model, field, message?)`
Ensures a value is **unique** in the database.

*   **Applies to**: `string`, `number`, `mixed`
*   **Usage**: Checking for duplicate emails, usernames, etc.

```typescript
yup.string()
   .email()
   .shouldNotExistInModel(User, 'email', 'Email already taken')
```

### `shouldExistInModel(Model, field, message?)`
Ensures a value **exists** in the database.

*   **Applies to**: `string`, `number`, `mixed`
*   **Usage**: Validating foreign keys (e.g., `roleId`, `categoryId`).
*   **✨ Magic Feature**: If found, the full record is stored in `req.form` using the field name key (e.g., `categoryId` -> `category_instance`).

```typescript
// Validates that 'roleId' exists in Role table
yup.number()
   .shouldExistInModel(Role, 'id')
```

### `shouldMatchField(fieldName, message?)`
Ensures two fields match (e.g., Password confirmation).

```typescript
confirmPassword: yup.string()
    .shouldMatchField('password', 'Passwords must match')
```

### `shouldBeStrongPassword(message?)`
Enforces strong password policy (Upper, Lower, Number, Special char, min 8).

```typescript
password: yup.string().shouldBeStrongPassword()
```

---

## 📝 Complete Example

Here is a robust Registration example combining standard validation and database checks.

```typescript
import { EtherialYup as yup } from 'etherial/components/http/yup.validator'
import { User } from '../models/User'

export const RegistrationSchema = yup.object().shape({
    username: yup.string()
        .required()
        .min(3)
        .shouldNotExistInModel(User, 'username'),
        
    email: yup.string()
        .email()
        .required()
        .shouldNotExistInModel(User, 'email'),
        
    password: yup.string()
        .required()
        .shouldBeStrongPassword(),
        
    confirmPassword: yup.string()
        .required()
        .shouldMatchField('password'),
        
    referralCode: yup.string()
        .nullable()
        // If provided, must exist. The referrer User object will be injected!
        .shouldExistInModel(User, 'referralCode') 
})
```

**Controller:**

```typescript
    @Post('/register')
    @ShouldValidateYupForm(RegistrationSchema)
    async register(req: Request, res: Response) {
        // req.form contains clean data
        // req.form.referralCode_instance contains the Referrer User object if it existed!
        
        const user = await User.create(req.form)
        res.success({ status: 201, data: user })
    }
```
