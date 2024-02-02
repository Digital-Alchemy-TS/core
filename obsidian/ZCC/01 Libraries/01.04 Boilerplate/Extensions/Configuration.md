## Configuration System Overview

  

The Configuration System in the Boilerplate Library is adept at managing and prioritizing settings from a variety of sources. This robust system ensures that the most relevant configuration is always used based on a predefined hierarchy.

  

### Configuration Retrieval Priority

  

1. **Current Set Value**: The highest priority is given to the current value already set in the system.

  

2. **Custom Config Loader** *(Optional)*: If implemented, custom loaders can provide configuration values, adding flexibility for specialized sources.

  

3. **Command Line Switches**: Configurations passed as command-line arguments are considered next, useful for overrides specific to a particular runtime.

  

4. **Environment Variables**: These are checked subsequently, often utilized for environment-specific settings, especially in production.

  

5. **File-Based Configurations**: The system searches for configurations in a series of file locations, reading from INI, JSON, or YAML files. The search paths include:

- Current working directory and parent directories up to the system root for `.{name}rc` files and variations with `.json`, `.ini`, `.yaml`/`.yml`

- User's home directory under `~/.config/{name}` and variations including `config` subfolder

  

If a file lacks an extension, the system attempts to interpret the format, defaulting to INI.

  

6. **Library/Application Defaults**: Default values defined within the library or application are used if no other sources provide the configuration.

  

7. **Dynamic Getter Configurations**: When using the `get` method, dynamic configurations can be specified as fallbacks.

  

This structured approach ensures that configurations are retrieved in a logical and systematic manner, catering to different environments and use cases. The system's capability to deep merge properties from various sources allows for granular control and flexibility in configuring your application.

  

### Example INI Configuration (`~/.config/{appName}`)

  

For a home automation system integrating with Home Assistant and MQTT, your INI configuration might look like this:

  

```ini

[application]

homeassistant_base_url = http://homeassistant.local:8123

homeassistant_token = YOUR_ACCESS_TOKEN

  

[application.mqtt]

host = mqtt.local

port = 1883

username = mqtt_user

password = mqtt_password

```

  

### 🛠 Sample Usage

  

#### 🌡 Updating a Sensor in Home Assistant

  

To update a sensor in Home Assistant:

  

```typescript

import axios from "axios";

  

const updateHomeAssistantSensor = async (sensorId, newState) => {

const baseUrl = ZCC.config.get<string>("homeassistant_base_url");

const token = ZCC.config.get<string>("homeassistant_token");

const url = `${baseUrl}/api/states/${sensorId}`;

  

await axios.post(url, { state: newState }, {

headers: { Authorization: `Bearer ${token}` }

});

};

  

// Example usage

updateHomeAssistantSensor('sensor.living_room_temperature', '23°C');

```

  

#### 📡 Initializing MQTT Client

  

For initializing an MQTT client:

  

```typescript

import { connect } from 'mqtt';

  

const initMQTTClient = () => {

const host = ZCC.config.get<string>("mqtt.host");

const port = ZCC.config.get<number>("mqtt.port");

const username = ZCC.config.get<string>("mqtt.username");

const password = ZCC.config.get<string>("mqtt.password");

  

const client = connect(`mqtt://${host}:${port}`, {

username,

password

});

  

return client;

};

  

// Example usage

const mqttClient = initMQTTClient();

```