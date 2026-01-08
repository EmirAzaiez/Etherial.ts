# Using ETHUserLeaf

## Strategy: Why & When?

### Why use this Leaf?
Authentication is critical, security-sensitive, and tedious to implement. `ETHUserLeaf` gives you a **battle-tested foundation** that covers 90% of modern app requirements immediately:
- **JWT Management**: Secure token generation and handling.
- **Multi-Provider**: Unified user model whether they sign in via Email, Google, or Apple.
- **Security Flow**: Built-in logic for password resets, email verification, and audit logging (crucial for admin dashboards).

### When NOT to use it?
- If you have an extremely specific legacy database schema that cannot adapt to the `User` model structure provided (though the model is extensible).
- If you use a completely external IAM (like Auth0 or AWS Cognito) and only need your backend to verify tokens without managing users locally.

## Integration Guide

### 1. Extending the User Model
The `User` model is the heart of your app. The leaf provides the core authenticatable fields, but you should extend it in `src/models/User.ts` for your business logic.

```typescript
@Table
export class User extends Model {
    // --- Managed by ETHUserLeaf ---
    @Column email: string;
    @Column firstname: string;
    // ...

    // --- Your Business Loigc ---
    @Column subscription_tier: string; // e.g., 'premium'

    @HasMany(() => Order)
    orders: Order[];
}
```

### 2. Frontend Integration (Auth Flow)
The leaf is designed to be "headless". Your frontend (React/Vue/Mobile) should checking the token.

**Typical Flow:**
1. **Login**: Call `POST /auth/email` or `POST /auth/google`.
2. **Store Token**: Save the returned JWT securely (SecureStore, HTTPOnly Cookie, etc.).
3. **Authenticated Requests**: Send `Authorization: Bearer <token>` header.
4. **401 Handling**: If you get a 401, clear the token and redirect to login.

### 3. Handling "Social-to-Password"
A smart feature of this leaf is the "Social-to-Password" flow.
- A user signs up with Google.
- Later, they want to set a password to log in via email.
- The UI checks `user.should_set_password`. If true, show a "Create Password" UI and call `POST /users/me/password`.
