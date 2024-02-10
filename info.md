# ZCC Synapse for Home Assistant

ZCC Synapse is a custom integration for Home Assistant that enables the creation and management of virtual entities like binary sensors, buttons, switches, and scenes, offering local push updates for real-time interaction.

## Features

- **Local Push Updates**: Instantly reflects changes in entity states within Home Assistant without polling.
- **Dynamic Entity Management**: Easily add, update, or remove entities based on external events.
- **Versatile Integration**: Supports binary sensors, buttons, switches, and scenes, catering to a variety of use cases.

## Installation

### Via HACS (Recommended)

1. Open HACS in the Home Assistant sidebar.
2. Go to "Integrations" and click the "+ Explore & add repositories" button in the bottom right corner.
3. Search for "ZCC Synapse" and select it.
4. Click "Install this repository in HACS".
5. Restart Home Assistant.

### Manual Installation

1. Navigate to your Home Assistant configuration directory (where your `configuration.yaml` file is located).
2. Create a new directory `custom_components/zcc` if it does not already exist.
3. Clone or download this repository and copy the contents of the `custom_components/zcc/` directory into the `custom_components/zcc/` directory you just created.
4. Restart Home Assistant.

## Configuration

After installation, add the following lines to your `configuration.yaml` file:

```yaml
zcc:
```

*Note: Further configuration might be required depending on your specific setup and use cases. Please refer to the [documentation](https://github.com/zoe-codez/zcc) for more details.*

## Usage

Once ZCC Synapse is installed and configured, it automatically manages the virtual entities based on external events.

- **Binary Sensors**: Reflect the state of external conditions or sensors.
- **Buttons**: Trigger actions in external systems or within Home Assistant.
- **Switches**: Control on/off states of external devices.
- **Scenes**: Activate predefined configurations of entities within Home Assistant.

## Support

For issues, questions, or contributions, please refer to the [GitHub repository](https://github.com/zoe-codez/zcc).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
