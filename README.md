# zcc core 🌟

## Introduction

`@zoe-codez/zcc`: A TypeScript framework designed for Home Assistant, enabling dynamic entity management, service calls, and automation with minimal dependencies.

## 📦 Major Exports

`@zoe-codez/zcc` framework is built on key exports, each offering unique features that complement one another:

- **@zoe-codez/zcc (Base Framework):** Provides caching, logging, configuration, lifecycle events, and utility types.

- **@zoe-codez/zcc/hass:** Facilitates base interactions with Home Assistant, including websocket connection management, entity reference checking, and a service call interface.

- **@zoe-codez/zcc/synapse:** Enables the generation of new entities in Home Assistant, such as buttons, sensors, and switches. Requires a socket connection and a custom component installation.

- **@zoe-codez/zcc/automation:** Focuses on home automation logic, offering room-based scene coordination, active state management for switches, circadian lighting, and more.

- **type-writer (CLI Tool):** A helper script that customizes internal type definitions by connecting to your Home Assistant instance and generating accurate service & entity validations.

## 🛠 Installation

### Synapse Integration

The Synapse component is essential for creating and managing entities within Home Assistant. Visit the [Synapse Repo](https://github.com/zoe-codez/synapse) for installation instructions and to understand its importance in your setup.

### npmrc Setup for GitHub Packages

This library is distributed via GitHub packages. To install, add the following to `.npmrc` in your project's root:

```npmrc
@zoe-codez:registry=https://npm.pkg.github.com
```

## 📚 External Libraries and Examples

Explore the full potential of `@zoe-codez/zcc` with our extensions library and illustrative examples. These resources are designed to expand the framework's functionality and provide inspiration for your projects:

### 📚 Extensions Library

Enhance your home automation capabilities with the [ZCC Extensions Library](https://github.com/zoe-codez/zcc-extensions), which includes:

- **MQTT Bindings:** Seamlessly integrate MQTT protocols for broader IoT connectivity.
- **Fastify Bindings:** Leverage Fastify to add efficient HTTP server functionality to your automation projects.

### 🎓 Demo and Example Repositories

Kickstart your development with these practical applications:

- **Mock Home:** A comprehensive sandbox for experimenting with and showcasing various automation techniques. [Mock Home on GitHub](https://github.com/zoe-codez/mock-home)
- **Automation Template:** A starter template to quickly get your projects up and running. [Automation Template on GitHub](https://github.com/zoe-codez/automation-template)

## 🤝 Contribution

We warmly welcome contributions. Whether you're enhancing the framework, sharing examples, or enriching documentation, your efforts significantly benefit the zcc community.
