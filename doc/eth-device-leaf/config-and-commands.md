# ETHDeviceLeaf Configuration & Commands

## Installation

```bash
etherial leaf:add ETHDeviceLeaf
```

## Configuration

The module is configured in your `src/Config.ts` file.

```typescript
import { ETHDeviceLeafConfig } from 'resources/leafs/ETHDeviceLeaf/app'
import EthDeviceLeaf from 'resources/leafs/ETHDeviceLeaf/app'

export default {
    eth_device_leaf: {
        module: EthDeviceLeaf,
        config: {
            // Used to force update on older clients
            last_app_build: process.env.LAST_APP_BUILD!,
            routes: {
                devices: ['registerDevice', 'revokeDevice']
            }
        } satisfies ETHDeviceLeafConfig
    }
}
```

### Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `LAST_APP_BUILD` | The latest app build version | Yes | `1.0.3` |

## Commands

No specific CLI commands are provided by this leaf.
