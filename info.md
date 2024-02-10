# ZCC Synapse Integration for Home Assistant

## Installation and Configuration

### Enabling ZCC Synapse

To integrate ZCC Synapse with Home Assistant, follow these steps:

#### Via HACS (Recommended)

1. Ensure you have [HACS](https://hacs.xyz/) installed in Home Assistant.
2. Open HACS from the Home Assistant sidebar.
3. Navigate to "Integrations" > "+ Explore & add repositories."
4. Search for "ZCC Synapse" and select it from the list.
5. Click "Install this repository in HACS."
6. Restart Home Assistant to apply the changes.

#### Manual Installation

If you prefer or need to install the integration manually:

1. Clone or download this repository.
2. Copy the `custom_components/zcc/` directory from the repository into the `<config_dir>/custom_components/` directory of your Home Assistant installation.
3. Restart Home Assistant.

### Configuration

After installation, add ZCC Synapse to your Home Assistant configuration:

```yaml
# Add to configuration.yaml
zcc:
```

### Setting Up the Node.js Application

Ensure your Node.js application using the `@zoe-codez/zcc/synapse` module is correctly configured to connect to Home Assistant:

1. Obtain a long-lived access token from your Home Assistant user profile page.
2. Use the token to authenticate the WebSocket connection in your Node.js application.
3. Start your Node.js application. It should automatically connect to Home Assistant and begin managing entities.

## Features, Workflows, and Supported Domains

### Seamless Integration

Upon setup, the Node.js application creates a direct, real-time link with Home Assistant, enabling dynamic entity management and event-driven communication with minimal manual intervention.

### Automatic Entity Management

The Synapse module communicates with Home Assistant, announcing available entities and pushing updates or responding to Home Assistant actions via the event bus. This creates a fluid, two-way interaction that doesn't require direct network configurations or persistent credentials.

### Supported Domains

Currently, ZCC Synapse supports managing various entity types within Home Assistant, including:

- **Switches**: Toggleable entities reflecting the state of external devices or services.
- **Sensors (with attributes)**: Entities providing readings from external data sources, including associated metadata.
- **Binary Sensors**: Represent binary states (on/off) of external conditions or inputs.
- **Buttons**: Triggerable entities that execute actions within external services.
- **Scenes**: Predefined configurations that adjust multiple entities to specific states (implementation by `@zoe-codez/zcc/automation`).

Future enhancements will expand support to additional domains, enhancing the integration's versatility and applicability to a broader range of automation scenarios.

## Usage

Once enabled, the ZCC Synapse integration automatically coordinates with the connected Node.js application to manage entities. This includes generating unique IDs, tracking history, and ensuring entities appear on dashboards and persist across Home Assistant restarts.

Switches can be manipulated via the Lovelace UI or service domain calls, just like native Home Assistant switches. Sensors follow a push model, with updates sent from the Node.js application to Home Assistant.

For more advanced automation and entity grouping, refer to `@zoe-codez/zcc/automation`, which provides tools for creating "rooms" and managing entity states and scene activation.

## Documentation and Support

For more detailed documentation and support, visit the [GitHub repository](https://github.com/zoe-codez/zcc). Please report any issues or feature requests there.
