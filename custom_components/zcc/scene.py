from homeassistant.components.scene import Scene as SceneEntity
from homeassistant.core import callback
from .const import DOMAIN
import logging
from .platform import generic_setup

_LOGGER = logging.getLogger(__name__)


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Setup the router platform."""
    await generic_setup(hass, "scene", ZccScene, async_add_entities)
    _LOGGER.debug("loaded")
    return True

class ZccScene(SceneEntity):
    def __init__(self, hass, app, entity):
        """Initialize the scene."""
        self.hass = hass
        self._app = app
        self.set_attributes(entity)

    @property
    def unique_id(self):
        """Return a unique identifier for this scene."""
        return self._id

    @property
    def name(self):
        """Return the name of the scene."""
        return self._name

    @property
    def extra_state_attributes(self):
        return {"Managed By": self._app}

    @property
    def available(self):
        """Return if the scene is available."""
        return self.hass.data[DOMAIN]["health_status"].get(self._app, False)

    async def receive_update(self, entity):
        self.set_attributes(entity)
        self.async_write_ha_state()

    def set_attributes(self, entity):
        self._id = entity.get("id")
        self._name = entity.get("name")
        self._icon = entity.get("icon", "mdi:lightbulb-night-outline")

    async def async_activate(self):
        """Activate the scene."""
        _LOGGER.info(f"activate scene {self._name} (ID: {self._id})")
        self.hass.bus.async_fire("zcc_activate", {"id": self._id})

    def update_info(self, entity):
        """Update the scene's information."""
        self._name = entity.get("name", self._name)
        self._icon = entity.get("icon", self._icon)
        self.async_write_ha_state()

    async def async_added_to_hass(self):
        """When entity is added to Home Assistant."""
        self.async_on_remove(
            self.hass.bus.async_listen(
                f"zcc_health_{self._app}", self._handle_health_update
            )
        )

    @callback
    def _handle_health_update(self, event):
        """React to health status updates."""
        self.async_schedule_update_ha_state(True)
