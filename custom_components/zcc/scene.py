from homeassistant.components.scene import Scene as SceneEntity
from homeassistant.core import callback
from .const import DOMAIN
import logging

_LOGGER = logging.getLogger(__name__)


async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Set up the ZCC scene platform."""
    if DOMAIN not in hass.data:
        return False

    if "scene" not in hass.data[DOMAIN]:
        hass.data[DOMAIN]["scene"] = {}

    async def handle_application_upgrade(event):
        """Handle updates to scene list or individual scene activations."""
        # * Process entities
        scenes_data = event.data.get('domains', {}).get("scene", {})
        app = event.data.get('app')
        existing_ids = set(hass.data[DOMAIN]["scene"].keys())
        incoming_ids = {scene["id"] for scene in scenes_data}
        _LOGGER.info(f"{app} sent {len(scenes_data)} entities")

        scenes_to_remove = existing_ids - incoming_ids

        for scene_info in scenes_data:
            scene_id = scene_info.get("id")
            if scene_id in hass.data[DOMAIN]["scene"]:
                # * Update existing entity
                entity = hass.data[DOMAIN]["scene"][scene_id]
                entity.update_info(scene_info)
                _LOGGER.debug(f"updating {scene_info.get('name')}")
            else:
                # * Create new entity
                _LOGGER.debug(f"{app} adding {scene_info.get('name')}")
                new_scene = ZccScene(hass, app, scene_info)
                hass.data[DOMAIN]["scene"][scene_id] = new_scene
                async_add_entities([new_scene], True)

        # * Remove entities not in the update
        for scene_id in scenes_to_remove:
            entity = hass.data[DOMAIN]["scene"].pop(scene_id, None)
            if entity:
                _LOGGER.debug(f"{app} remove {entity._name}")
                await entity.async_remove()

    # * Attach update listener
    hass.bus.async_listen("zcc_application_state", handle_application_upgrade)
    return True


class ZccScene(SceneEntity):
    """A class for ZCC scenes."""

    def __init__(self, hass, app, scene_info):
        """Initialize the scene."""
        self.hass = hass
        self._app = app
        self._id = scene_info.get("id")
        self._name = scene_info.get("name")
        self._icon = scene_info.get("icon", "mdi:lightbulb-night-outline")

    @property
    def unique_id(self):
        """Return a unique identifier for this scene."""
        return self._id

    @property
    def name(self):
        """Return the name of the scene."""
        return self._name

    @property
    def available(self):
        """Return if the scene is available."""
        return self.hass.data[DOMAIN]["health_status"].get(self._app, False)

    async def async_activate(self):
        """Activate the scene."""
        # Here you'd call the actual scene activation API or mechanism
        # For example, self._api.activate_scene(self._id)
        _LOGGER.info(f"activate scene {self._name} (ID: {self._id})")
        # Emit an event indicating the scene was activated
        self.hass.bus.async_fire("zcc_scene_activate", {"scene": self._id})

    def update_info(self, scene_info):
        """Update the scene's information."""
        self._name = scene_info.get("name", self._name)
        self._icon = scene_info.get("icon", self._icon)
        self.async_write_ha_state()

    async def async_added_to_hass(self):
        """When entity is added to Home Assistant."""
        self.async_on_remove(
            self.hass.bus.async_listen(
                f"zcc_{self._app}_health_status_updated", self._handle_health_update
            )
        )

    @callback
    def _handle_health_update(self, event):
        """React to health status updates."""
        self.async_schedule_update_ha_state(True)
