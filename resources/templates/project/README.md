# My Etherial App

Project created with [Etherial.ts](https://github.com/EtherialFramework/Etherial.ts)

## Prerequisites

Install Etherial CLI globally:

```bash
npm install -g github:EtherialFramework/Etherial.ts
```

## Installation

```bash
npm install
```

## Configuration

```bash
cp .env.example .env
```

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm start
```

## Commands

```bash
# List all available commands
etherial cmd

# Run a specific command
etherial cmd database:migrate
etherial cmd database:seed
```

## Leafs

```bash
# List available Leafs
etherial leaf:list

# Install a Leaf
etherial leaf:add ETHUserLeaf
etherial leaf:add ETHMediaLeaf
etherial leaf:add ETHDeviceLeaf

# Update a Leaf
etherial leaf:update ETHUserLeaf

# Remove a Leaf
etherial leaf:remove ETHUserLeaf
```

## Structure

```
├── src/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── forms/
│   ├── Config.ts      # Etherial configuration
│   ├── app.ts         # App module
│   └── server.ts      # Entry point
├── resources/
└── package.json
```
