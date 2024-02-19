# Digital Alchemy core 🌟

## Introduction

`@digital-alchemy`: A TypeScript framework designed for Home Assistant, enabling dynamic entity management, service calls, and automation with minimal dependencies.

## 📦 Major Exports

`@digital-alchemy` framework is built on key exports, each offering unique features that complement one another:

- **@digital-alchemy/core (Base Framework):** Provides caching, logging, configuration, lifecycle events, and utility types.

- **@digital-alchemy/core/hass:** Facilitates base interactions with Home Assistant, including websocket connection management, entity reference checking, and a service call interface.

- **@digital-alchemy/core/synapse:** Enables the generation of new entities in Home Assistant, such as buttons, sensors, and switches. Requires a socket connection and a custom component installation.

- **@digital-alchemy/core/automation:** Focuses on home automation logic, offering room-based scene coordination, active state management for switches, circadian lighting, and more.

- **type-writer (CLI Tool):** A helper script that customizes internal type definitions by connecting to your Home Assistant instance and generating accurate service & entity validations.

## 🛠 Installation

### Synapse Integration

The Synapse component is essential for creating and managing entities within Home Assistant. Visit the [Synapse Repo](https://github.com/zoe-codez/synapse) for installation instructions and to understand its importance in your setup.

## 📚 External Libraries and Examples

Explore the full potential of `@digital-alchemy/core` with our extensions library and illustrative examples. These resources are designed to expand the framework's functionality and provide inspiration for your projects:

### 📚 Extensions Library

Enhance your home automation capabilities with the [Digital Alchemy Extensions Library](https://github.com/digital-alchemy-extensions), which includes:

- **MQTT Bindings:** Seamlessly integrate MQTT protocols for broader IoT connectivity.
- **Fastify Bindings:** Leverage Fastify to add efficient HTTP server functionality to your automation projects.

### 🎓 Demo and Example Repositories

Kickstart your development with these practical applications:

- **Mock Home:** A comprehensive sandbox for experimenting with and showcasing various automation techniques. [Mock Home on GitHub](https://github.com/zoe-codez/mock-home)
- **Automation Template:** A starter template to quickly get your projects up and running. [Automation Template on GitHub](https://github.com/zoe-codez/automation-template)

## 🤝 Contribution

We warmly welcome contributions. Whether you're enhancing the framework, sharing examples, or enriching documentation, your efforts significantly benefit the community.
