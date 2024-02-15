from homeassistant.components.switch import SwitchEntity
from homeassistant.core import callback
from .const import DOMAIN
import logging
from .platform import generic_setup

_LOGGER = logging.getLogger(__name__)


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Setup the router platform."""
    await generic_setup(hass, "switch", ZccSwitch, async_add_entities)
    _LOGGER.debug("loaded")
    return True

class ZccSwitch(SwitchEntity):
    def __init__(self, hass, app, entity):
        """Initialize the switch."""
        self.hass = hass
        self._app = app
        self.set_attributes(entity)

    @property
    def unique_id(self):
        """Return a unique identifier for this switch."""
        return self._id

    @property
    def name(self):
        """Return the name of the switch."""
        return self._name

    @property
    def is_on(self):
        """Return True if the switch is on."""
        return self._state

    @property
    def extra_state_attributes(self):
        return {"Managed By": self._app}

    @property
    def available(self):
        """Return if the switch is available."""
        return self.hass.data[DOMAIN]["health_status"].get(self._app, False)

    async def receive_update(self, entity):
        self.set_attributes(entity)
        self.async_write_ha_state()

    def set_attributes(self, entity):
        self._id = entity.get("id")
        self._name = entity.get("name")
        self._icon = entity.get("icon", "mdi:electric-switch")
        self._state = entity.get("state", "off") == "on"

    async def async_turn_on(self):
        """Turn the switch on."""
        await self._update_switch("on")

    async def async_turn_off(self):
        """Turn the switch off."""
        await self._update_switch("off")

    async def _update_switch(self, new_state):
        """Send a state update to the external service."""
        if self._state != (new_state == "on"):
            self._state = new_state == "on"
            self.async_write_ha_state()
            self.hass.bus.async_fire(
                "zcc_switch_update", {"data": {"switch": self._id, "state": new_state}}
            )

    async def async_added_to_hass(self):
        """When entity is added to Home Assistant."""
        self.async_on_remove(
            self.hass.bus.async_listen("zcc_event", self._handle_switch_update)
        )
        self.async_on_remove(
            self.hass.bus.async_listen(
                f"zcc_health_{self._app}", self._handle_health_update
            )
        )

    @callback
    def _handle_switch_update(self, event):
        """Handle incoming switch state updates."""
        if event.data.get("id") == self._id:
            new_state = event.data.get("data", {}).get("state")

            # Prevent circular updates by checking if the state actually changed
            if new_state != ("on" if self._state else "off"):
                self._state = new_state == "on"
                self.async_write_ha_state()

    @callback
    async def _handle_health_update(self, event):
        """Handle health status update."""
        self.async_schedule_update_ha_state(True)
