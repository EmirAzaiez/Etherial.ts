# ETHDeviceLeaf Routes & Forms

## Devices

### `POST /devices/register`
**Method:** `registerDevice`
*Registers a device token (e.g., Expo Push Token) and updates metadata.*

**Form Validation:** `RegisterDeviceForm` (Yup)
- `device`: string | uuid v4 | required (Unique device ID)
- `platform`: number | optional (0=Web, 1=Android, 2=iOS)
- `push_token`: string | optional
- `locale`: string | optional
- `tz`: string | optional
- `brand`: string | optional
- `model`: string | optional
- `os_version`: string | optional
- `app_version`: string | optional
- `user_agent`: string | optional

**Response (200):**
```json
{
    "status": 200,
    "data": {}
}
```

### `POST /devices/revoke`
**Method:** `revokeDevice`
*Removes the assignment of a user to a device (Logout).*
*Note: Depending on configuration, this might just unlink the user_id but keep the device record.*

**Form Validation:** `RevokeDeviceForm` (Yup)
- `device`: string | uuid v4 | required

**Response (200):**
```json
{
    "status": 200,
    "data": {}
}
```
