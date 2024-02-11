# zcc core

## Introduction

`@zoe-codez/zcc`: A TypeScript framework for Home Assistant, enabling dynamic entity management, service calls, and automation with minimal dependencies.

## Major Exports

`@zoe-codez/zcc` framework is structured around key exports having features that build on each other. Each library depends on the previous moving down this list

### @zoe-codez/zcc (Base Framework)

Base framework, provides:

- caching
- logger
- configuration
- lifecycle events
- utility types

### @zoe-codez/zcc/hass

Base interactions with Home Assistant. Automatically manages websocket connections, entity references for checking state, service call interface, and more.

### @zoe-codez/zcc/synapse

Generate new entities in Home Assistant. This library allows you to create buttons, sensors, switches, and more!

Requires socket connection, and custom component to be installed.

### @zoe-codez/zcc/automation

Home Automation focused logic. Room based scene coordination, active state management for switches, circadian lighting, and other fun toys!

### type-writer (CLI Tool)

Helper script for customizing internal type definitions. Connects to your Home Assistant instance, and builds customized definitions for accurate service & entity validation.

## Installation

### Home Assistant Community Store (HACS)

1. Ensure HACS is installed in your Home Assistant instance.
2. Navigate to HACS > Integrations > ... (top right) > Custom repositories.
3. Add `https://github.com/zoe-codez/zcc` as a custom repository with the category "Integration".
4. Find the `@zoe-codez/zcc` integration in the list and click "Install".

#### Configuration.yaml

Add the following line to your `configuration.yaml` file to enable the custom component:

```yaml
zcc:
```

> No additional configuration

### npmrc Setup for GitHub Packages

This library ships via github packages. Add the following to `.npmrc` in your repo root to install:

```npmrc
@zoe-codez:registry=https://npm.pkg.github.com
```

## External Libraries and Examples

Enhance your experience with `@zoe-codez/zcc` by exploring our collection of external libraries and example projects. These resources are designed to extend the framework's functionality and provide real-world applications to inspire your development.

### Additional Libraries

Extend the capabilities of `@zoe-codez/zcc` with these additional libraries:

- **MQTT Bindings**: [Link to repo] - Integrate MQTT protocols seamlessly into your Home Assistant automation for broader IoT connectivity.
- **Fastify Bindings**: [Link to repo] - Leverage Fastify for efficient HTTP server functionalities within your home automation projects.

### Demo and Example Repositories

Get inspired and learn from these demo and example repositories showcasing practical applications of `@zoe-codez/zcc`:

- **Basic Home Automation**: [Link to repo] - A starter example demonstrating basic home automation concepts using `@zoe-codez/zcc`.
- **Advanced Scene Management**: [Link to repo] - Explore advanced scene management and automation logic with this comprehensive guide.

### Callout Applications

Discover applications built with `@zoe-codez/zcc` that highlight its potential in complex scenarios:

- **Smart Lighting System**: [Link to repo] - An application focusing on dynamic lighting control across different rooms.
- **Security and Surveillance**: [Link to repo] - A project demonstrating the integration of security cameras and sensors for enhanced home security.

## Documentation and Support

- For more detailed documentation, refer to the included Obsidian notebook.
- If you encounter issues or have suggestions, please open a ticket in the GitHub repository. Your feedback is invaluable for improving `@zoe-codez/zcc`.

## Contribution

Contributions are welcome! Whether it's extending the framework with new features, providing examples, or improving documentation, your input helps make `@zoe-codez/zcc` better for everyone.
