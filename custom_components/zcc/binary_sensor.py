from .const import DOMAIN
from homeassistant.core import callback
from homeassistant.components.binary_sensor import BinarySensorEntity
import logging
from .platform import generic_setup
from .health_sensor import HealthCheckSensor

_LOGGER = logging.getLogger(__name__)


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Setup the router platform."""

    @callback
    def handle_application_upgrade(event):
        app = event.data.get("app")

        if "health_sensor" not in hass.data[DOMAIN]:
            hass.data[DOMAIN]["health_sensor"] = {}


        # * First time seeing this app, create health check sensor
        if hass.data[DOMAIN]["health_sensor"].get(app, None) == None:
            incoming = HealthCheckSensor(hass, app)
            hass.data[DOMAIN]["health_sensor"][app] = incoming
            async_add_entities([incoming], True)

    hass.bus.async_listen("zcc_application_state", handle_application_upgrade)
    await generic_setup(hass, "binary_sensor", ZccBinarySensor, async_add_entities)
    _LOGGER.debug("loaded")
    return True


class ZccBinarySensor(BinarySensorEntity):
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
    def icon(self):
        return self._icon

    @property
    def is_on(self):
        return self._state

    @property
    def extra_state_attributes(self):
        return {"Managed By": self._app}

    @property
    def available(self):
        return self.hass.data[DOMAIN]["health_status"].get(self._app, False)

    def set_attributes(self, entity):
        self._id = entity.get("id")
        self._name = entity.get("name")
        self._icon = entity.get("icon", "mdi:toggle-switch-variant-off")
        self._state = entity.get("state", "off") == "on"

    async def receive_update(self, entity):
        self.set_attributes(entity)
        self.async_write_ha_state()

    async def async_added_to_hass(self):
        """When entity is added to Home Assistant."""
        self.async_on_remove(
            self.hass.bus.async_listen(
                f"zcc_health_{self._app}", self._handle_health_update
            )
        )

        self.async_on_remove(
            self.hass.bus.async_listen("zcc_event", self.handle_binary_sensor_event)
        )

    @callback
    async def _handle_health_update(self, event):
        """Handle health status update."""
        self.async_schedule_update_ha_state(True)

    async def handle_binary_sensor_event(self, event):
        """Handle incoming binary sensor update events."""
        if event.data.get("id") == self._id:
            new_state = event.data.get("data", {}).get("state")
            if new_state:
                self._state = True if new_state == "on" else False
                self.async_write_ha_state()
