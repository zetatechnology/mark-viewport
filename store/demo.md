---
title: Acme CLI
version: 2.4.0
---

# Acme CLI

A fast, friendly command-line tool for managing **Acme** projects. Works on macOS, Linux and Windows.

> **Note**
> Version 2.4 adds workspace support. See the [migration guide](#migrating-from-23) if you are upgrading.

## Installation

```bash
npm install -g acme-cli
acme --version
```

## Quick start

1. Create a new project with `acme init`
2. Add your first service
3. Run `acme dev` and open http://localhost:3000

## Configuration

Settings live in `acme.config.ts` at the project root:

```ts
import { defineConfig } from 'acme-cli';

export default defineConfig({
  name: 'my-app',
  port: 3000,
  services: ['api', 'worker'],
  // Reload when files change
  watch: true,
});
```

| Option | Type | Default | Description |
| :--- | :--- | :---: | :--- |
| `name` | string | — | Project name |
| `port` | number | `3000` | Dev server port |
| `watch` | boolean | `true` | Reload on change |

## Roadmap

- [x] Workspace support
- [x] Windows installer
- [ ] Plugin marketplace
- [ ] Remote build cache

## Migrating from 2.3

The `services` option replaces `apps`[^1]. Rename the key and you are done.

```diff
- apps: ['api', 'worker'],
+ services: ['api', 'worker'],
```

## License

MIT © Acme

[^1]: `apps` still works in 2.4 but prints a deprecation warning.
