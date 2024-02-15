from homeassistant.components.sensor import SensorEntity
from .const import DOMAIN
from homeassistant.core import callback
import logging
from .platform import generic_setup

_LOGGER = logging.getLogger(__name__)


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Setup the router platform."""
    await generic_setup(hass, "sensor", ZccSensor, async_add_entities)
    _LOGGER.debug("loaded")
    return True

class ZccSensor(SensorEntity):
    def __init__(self, hass, app, entity):
        self.hass = hass
        self._app = app
        self.set_attributes(entity)

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
        return {**self._attributes, "Managed By": self._app}

    async def receive_update(self, entity):
        self.set_attributes(entity)
        self.async_write_ha_state()

    def set_attributes(self, entity):
        self._id = entity.get("id")
        self._name = entity.get("name")
        self._icon = entity.get("icon", "mdi:satellite-uplink")
        self._state = entity.get("state", "")
        self._unit_of_measurement = entity.get("unit_of_measurement")
        self._attributes = entity.get("attributes", {})
        self._device_class = entity.get("device_class", None)

    @property
    def available(self):
        return self.hass.data[DOMAIN]["health_status"].get(self._app, False)

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
            self.hass.bus.async_listen(
                f"zcc_health_{self._app}", self._handle_health_update
            )
        )
        self.async_on_remove(
            self.hass.bus.async_listen("zcc_event", self._handle_event_sensor)
        )

    async def _handle_event_sensor(self, event):
        """Handle individual sensor state or attribute updates."""
        if event.data.get("id") == self._id:
            data = event.data.get("data")
            if "state" in data:
                self.update_state(data["state"])
            if "attributes" in data:
                for attr, value in data["attributes"].items():
                    self.update_attribute(attr, value)

    @callback
    async def _handle_health_update(self, event):
        """Handle health status update."""
        self.async_schedule_update_ha_state(True)
