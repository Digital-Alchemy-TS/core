from .api import ZccApi
from .health_sensor import HealthCheckSensor, start_health_check_polling
from . import DOMAIN
from homeassistant.components.binary_sensor import BinarySensorEntity

async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Setup the ZCC binary sensor platform."""
    # Ensure API is already set up
    if DOMAIN not in hass.data:
        return False

    api = hass.data[DOMAIN]['api']

    # Fetch service data to create a meaningful sensor name
    service_name = hass.data[DOMAIN]['service_data']['name']
    sensor_name = f"{service_name}_is_online"
    sensor = HealthCheckSensor(api, sensor_name)

    async_add_entities([sensor], True)

    hass.loop.create_task(start_health_check_polling(api, sensor, hass))

    sensors_data = await api.list_binary_sensors()
    if sensors_data is None:
        return
    sensors = [ZccBinarySensor(hass, api, sensor) for sensor in sensors_data['sensors']]
    async_add_entities(sensors)

class ZccBinarySensor(BinarySensorEntity):
    def __init__(self, hass, api, sensor_info):
        self.hass = hass
        self._api = api
        self._id = sensor_info['id']
        self._name = sensor_info['name']
        self._icon = sensor_info['icon']
        self._state = sensor_info['state'] == "on"

    @property
    def unique_id(self):
        """Return a unique ID."""
        return self._id

    @property
    def name(self):
        return self._name

    @property
    def icon(self):
        return self._icon

    @property
    def is_on(self):
        return self._state

    @property
    def available(self):
        return self.hass.data[DOMAIN].get('health_status', False)

    async def async_turn_on(self):
        """Turn the switch on."""
        self._state = True
        self.async_write_ha_state()

    async def async_turn_off(self):
        """Turn the switch off."""
        self._state = False
        self.async_write_ha_state()
