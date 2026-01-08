# Using ETHDeviceLeaf

## Strategy: Why & When?

### Why use this Leaf?
This leaf provides a standard way to track user devices and link them to push tokens.
- **Device Fingerprinting**: It encourages sending a UUID (`device`) for every client, allowing you to track "sessions" or "installs" even if the push token changes.
- **Metadata Storage**: Automatically stores OS version, App Version, and Timezone, which is crucial for debugging "Why did this user crash?" or "What time should I send a notification?".

### When NOT to use it?
- If you don't need to track device metadata or push tokens at all.

## Integration Guide

### 1. App Launch (Register)

Calls this on app launch. It handles both "Anonymous" and "Logged In" states if you send the token or not.

**Endpoint**: `POST /devices/register`

```javascript
// React Native Example
import * as Device from 'expo-device';
import * as Application from 'expo-application';

const deviceId = await getSecureDeviceId(); // Your logic to generate/store a UUID

await api.post('/devices/register', {
  device: deviceId,
  platform: Platform.OS === 'ios' ? 2 : 1,
  push_token: pushToken, // if available
  app_version: Application.nativeBuildVersion,
  model: Device.modelName
});
```

### 2. User Logout (Revoke)

When a user logs out, you must tell the backend to dissociate this `device` UUID from the `user_id`, otherwise the next user on this device might receive the previous user's notifications.

**Endpoint**: `POST /devices/revoke`

```javascript
await api.post('/devices/revoke', {
  device: deviceId // The same UUID used in register
});
```
