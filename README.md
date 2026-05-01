[![codecov](https://codecov.io/github/Digital-Alchemy-TS/core/graph/badge.svg?token=IBGLY3RY68)](https://codecov.io/github/Digital-Alchemy-TS/core)
[![version](https://img.shields.io/github/package-json/version/Digital-Alchemy-TS/core)](https://www.npmjs.com/package/@digital-alchemy/core)
[![stars](https://img.shields.io/github/stars/Digital-Alchemy-TS/core)](https://github.com/Digital-Alchemy-TS/core)

---
<div align="center">

![Digital Alchemy](https://raw.githubusercontent.com/Digital-Alchemy-TS/.github/main/profile/github-logo.png)

</div>

## Install

```bash
yarn add @digital-alchemy/core
```

## Introduction

`@digital-alchemy/core` is a dependency-injection framework for TypeScript — no decorators, no reflection, no class hierarchy. Services are plain functions that receive their dependencies through a single typed parameter. The framework wires everything at boot time, with full type safety across your entire service graph.

Targets the latest ESModule syntax and runs on Bun, Deno, and modern Node.

## At a glance

```typescript
import { CreateApplication, TServiceParams } from "@digital-alchemy/core";

function HelloService({ logger, lifecycle }: TServiceParams) {
  lifecycle.onReady(() => logger.info("hello world"));
}

const app = CreateApplication({
  name: "hello",
  services: { hello: HelloService },
});

await app.bootstrap();
```

## What it does

- **Service wiring** - Automatic dependency injection with full type safety
- **Configuration** - Load config from files, environment variables, CLI args
- **Logging** - Structured logging with customizable outputs
- **Lifecycle hooks** - Run code during app startup/shutdown
- **Task scheduling** - Cron jobs and timers
- **Testing utilities** - Mock and test your services easily

## Questions / Issues?

[![discord](https://img.shields.io/discord/1219758743848489147?label=Discord&logo=discord)](https://discord.gg/JkZ35Gv97Y)
