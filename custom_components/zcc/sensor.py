from homeassistant.components.sensor import SensorEntity
from .const import DOMAIN
from homeassistant.core import callback
import logging

_LOGGER = logging.getLogger(__name__)

async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Set up the ZCC sensor platform."""
    # Placeholder for storing sensor entities for easy access and management
    if 'zcc_sensor_entities' not in hass.data[DOMAIN]:
        hass.data[DOMAIN]['zcc_sensor_entities'] = {}

    async def handle_list_sensors(event):
        """Handle the complete list of sensors."""
        sensors_data = event.data['sensor']
        # Existing entity unique_ids
        existing_ids = set(hass.data[DOMAIN]['zcc_sensor_entities'].keys())
        incoming_ids = {sensor['id'] for sensor in sensors_data}

        # Remove sensors not in the incoming list
        sensors_to_remove = existing_ids - incoming_ids
        for sensor_id in sensors_to_remove:
            entity = hass.data[DOMAIN]['zcc_sensor_entities'].pop(sensor_id, None)
            if entity:
                await entity.async_remove()

        # Update existing or add new sensors
        for sensor_info in sensors_data:
            sensor_id = sensor_info['id']
            if sensor_id in hass.data[DOMAIN]['zcc_sensor_entities']:
                # Update existing sensor
                entity = hass.data[DOMAIN]['zcc_sensor_entities'][sensor_id]
                entity.update_all(sensor_info['state'], sensor_info.get('attributes', {}))
            else:
                # Create and add new sensor
                new_sensor = ZccSensor(hass, sensor_info)
                hass.data[DOMAIN]['zcc_sensor_entities'][sensor_id] = new_sensor
                async_add_entities([new_sensor])

    # Listen for sensor update events
    hass.bus.async_listen('zcc_list_sensor', handle_list_sensors)


class ZccSensor(SensorEntity):
    def __init__(self, hass, sensor_info):
        self.hass = hass
        self._id = sensor_info['id']
        self._name = sensor_info['name']
        self._icon = sensor_info.get('icon')
        self._state = sensor_info['state']
        self._unit_of_measurement = sensor_info.get('unit_of_measurement')
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
    def icon(self):
        """Return the icon of the sensor."""
        return self._icon

    @property
    def device_class(self):
        return self._device_class

    @property
    def unit_of_measurement(self):
        return self._unit_of_measurement

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

    async def async_added_to_hass(self):
        """When entity is added to Home Assistant."""
        self.async_on_remove(
            self.hass.bus.async_listen('zcc_health_status_updated', self._handle_health_update)
        )
        self.async_on_remove(
            self.hass.bus.async_listen('zcc_event_sensor', self._handle_event_sensor)
        )

    async def _handle_event_sensor(self, event):
        """Handle individual sensor state or attribute updates."""
        if event.data.get('id') == self._id:
            data = event.data.get('data')
            if 'state' in data:
                self.update_state(data['state'])
            elif 'attributes' in data:
                for attr, value in data['attributes'].items():
                    self.update_attribute(attr, value)

    @callback
    async def _handle_health_update(self, event):
        """Handle health status update."""
        self.async_schedule_update_ha_state(True)
