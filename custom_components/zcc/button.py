from homeassistant.components.button import ButtonEntity
from homeassistant.core import callback
from .const import DOMAIN
import logging
from .platform import generic_setup

_LOGGER = logging.getLogger(__name__)


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Setup the router platform."""
    await generic_setup(hass, "button", ZccButton, async_add_entities)
    _LOGGER.debug("loaded")
    return True

class ZccButton(ButtonEntity):
    def __init__(self, hass, app, entity):
        """Initialize the button."""
        self.hass = hass
        self._app = app;
        self.set_attributes(entity)

    @property
    def unique_id(self):
        """Return a unique identifier for this button."""
        return self._id

    @property
    def name(self):
        """Return the name of the button."""
        return self._name

    @property
    def icon(self):
        """Return the icon of the button."""
        return self._icon

    @property
    def available(self):
        return self.hass.data[DOMAIN]["health_status"].get(self._app, False)

    @property
    def extra_state_attributes(self):
        return {"Managed By": self._app}

    def set_attributes(self, entity):
        self._id = entity.get("id")
        self._name = entity.get("name")
        self._icon = entity.get("icon", "mdi:gesture-tap")

    async def receive_update(self, entity):
        self.set_attributes(entity)
        self.async_write_ha_state()

    async def async_press(self):
        """Handle the button press."""
        _LOGGER.debug(f"emit zcc_button_press for {self._name} ({self._id})")
        self.hass.bus.async_fire("zcc_activate", {"id": self._id})

    async def async_added_to_hass(self):
        """When entity is added to Home Assistant."""
        self.async_on_remove(
            self.hass.bus.async_listen(
                f"zcc_health_{self._app}", self._handle_health_update
            )
        )

    @callback
    async def _handle_health_update(self, event):
        """Handle health status update."""
        self.async_schedule_update_ha_state(True)
