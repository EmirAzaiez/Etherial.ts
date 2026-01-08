# ETHUserLeaf Routes & Forms

## Authentication

### `POST /auth/email`
**Method:** `authEmail`
*Login with email and password.*

**Form Validation:** `AuthFormEmail` (Yup)
- `email`: string | email | required
- `password`: string | required
- `device`: string | uuid v4 | optional

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsIn..."
    }
}
```

### `POST /auth/username`
**Method:** `authUsername`
*Login with username and password.*

**Form Validation:** `AuthFormUsername` (Yup)
- `username`: string | required
- `password`: string | required
- `device`: string | uuid v4 | optional

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsIn..."
    }
}
```

### `POST /auth/google`
**Method:** `authGoogle`
*Login or Register with Google Access Token.*

**Form Validation:** `AuthFormGoogle` (Yup)
- `google_token`: string | required

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsIn..."
    }
}
```

### `POST /auth/apple`
**Method:** `authApple`
*Login or Register with Apple Identity Token.*

**Form Validation:** `AuthFormApple` (Yup)
- `apple_token`: string | required
- `firstname`: string | optional
- `lastname`: string | optional

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsIn..."
    }
}
```

## User Profile

### `PUT /users/me/bio`
**Method:** `updateUserMeBio`
*Update user biography.*

**Form Validation:** `UpdateBioForm` (Yup)
- `bio`: string | required

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "bio": "New bio content"
    }
}
```

### `PUT /users/me/avatar`
**Method:** `updateUserMeAvatar`
*Update user avatar (S3 key).*

**Form Validation:** `UpdateAvatarForm` (Yup)
- `avatar`: string | s3-file-key | required
    - *Constraint:* Must be a valid file in `user-avatar` folder (checked via S3 extension).

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "avatar": "user-avatar/filename.jpg"
    }
}
```

## Password Management

### `PUT /users/me/password`
**Method:** `userUpdatePassword`
*Change password (requires current password).*

**Form Validation:** `UpdatePasswordForm` (Yup)
- `current_password`: string | required
- `new_password`: string | required

**Response (200):**
```json
{ "status": 200, "data": {} }
```

### `POST /users/me/password`
**Method:** `setUserPassword`
*Set password for the first time (Social Login users).*
*Only works if `user.should_set_password` is true.*

**Form Validation:** `CreatePasswordForm` (Yup)
- `password`: string | required

**Response (200):**
```json
{ "status": 200, "data": {} }
```

### `POST /users/password/reset/request`
**Method:** `requestPasswordReset`
*Send password reset email.*

**Form Validation:** `PasswordResetRequestForm` (Yup)
- `email`: string | email | required

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "message": "If this email exists, a password reset link has been sent"
    }
}
```

### `POST /users/password/reset/confirm`
**Method:** `confirmPasswordReset`
*Reset password using token.*

**Form Validation:** `PasswordResetConfirmForm` (Yup)
- `email`: string | email | required
- `token`: string | required
- `new_password`: string | required

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "message": "Password has been reset successfully"
    }
}
```

## Phone Validation

### `POST /users/me/phone/send`
**Method:** `sendPhoneValidation`
*Send SMS verification code.*

**Form Validation:** `PhoneValidationSendForm` (Yup)
- `phone`: string | optional
    - *Constraint:* Must include country code (e.g., +123...), must not exist in `User` model.

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "message": "Phone validation code sent successfully"
    }
}
```

### `POST /users/me/phone/confirm`
**Method:** `confirmPhoneValidation`
*Verify SMS code.*

**Form Validation:** `PhoneValidationConfirmForm` (Yup)
- `token`: string | required

**Response (200):**
```json
{
    "status": 200,
    "data": {
        "message": "Phone number has been confirmed successfully"
    }
}
```
