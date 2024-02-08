from homeassistant.components.sensor import SensorEntity
from . import DOMAIN

class ZccSensor(SensorEntity):
    def __init__(self, hass, api, sensor_info):
        self.hass = hass
        self._api = api
        self._id = sensor_info['id']
        self._name = sensor_info['name']
        self._state = sensor_info['state']
        self._attributes = sensor_info.get('attributes', {})
        self._device_class = sensor_info.get('device_class', None)

    @property
    def unique_id(self):
        """Return a unique ID."""
        return self._id

    @property
    def name(self):
        return self._name

    @property
    def state(self):
        return self._state

    @property
    def device_class(self):
        return self._device_class

    @property
    def extra_state_attributes(self):
        return self._attributes

    @property
    def available(self):
        return self.hass.data[DOMAIN].get('health_status', False)

    def update_state(self, state):
        self._state = state
        self.async_write_ha_state()

    def update_attribute(self, attribute, value):
        self._attributes[attribute] = value
        self.async_write_ha_state()

    def update_all(self, state, attributes):
        self._state = state
        self._attributes = attributes
        self.async_write_ha_state()

async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Set up the ZCC sensor platform."""
    api = hass.data[DOMAIN]['api']
    sensors_data = await api.list_sensors()
    if sensors_data is None:
        return
    sensors = [ZccSensor(hass, api, sensor) for sensor in sensors_data['sensors']]
    async_add_entities(sensors)
