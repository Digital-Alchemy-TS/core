from homeassistant.components.scene import Scene as SceneEntity
from homeassistant.core import callback
from .const import DOMAIN
import logging

_LOGGER = logging.getLogger(__name__)

async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Set up the ZCC scene platform."""
    if 'zcc_scene_entities' not in hass.data[DOMAIN]:
        hass.data[DOMAIN]['zcc_scene_entities'] = {}

    async def handle_scene_update(event):
        """Handle updates to scene list or individual scene activations."""
        scenes_data = event.data['scene']
        existing_ids = set(hass.data[DOMAIN]['zcc_scene_entities'].keys())
        incoming_ids = {scene['id'] for scene in scenes_data}

        # Remove scenes not in the incoming list
        scenes_to_remove = existing_ids - incoming_ids
        for scene_id in scenes_to_remove:
            entity = hass.data[DOMAIN]['zcc_scene_entities'].pop(scene_id, None)
            if entity:
                await entity.async_remove()

        # Add or update scenes
        for scene_info in scenes_data:
            scene_id = scene_info['id']
            if scene_id in hass.data[DOMAIN]['zcc_scene_entities']:
                # Update existing scene
                entity = hass.data[DOMAIN]['zcc_scene_entities'][scene_id]
                entity.update_info(scene_info)
            else:
                # Create and add new scene
                new_scene = ZccScene(hass, scene_info)
                hass.data[DOMAIN]['zcc_scene_entities'][scene_id] = new_scene
                async_add_entities([new_scene], True)

    hass.bus.async_listen('zcc_list_scene', handle_scene_update)

class ZccScene(SceneEntity):
    """A class for ZCC scenes."""

    def __init__(self, hass, scene_info):
        """Initialize the scene."""
        self.hass = hass
        self._id = scene_info['id']
        self._name = scene_info['name']
        self._icon = scene_info.get('icon')

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
        return self.hass.data[DOMAIN].get('health_status', False)

    async def async_activate(self):
        """Activate the scene."""
        # Here you'd call the actual scene activation API or mechanism
        # For example, self._api.activate_scene(self._id)
        _LOGGER.info(f"Activating scene {self._name} (ID: {self._id})")
        # Emit an event indicating the scene was activated
        self.hass.bus.async_fire('zcc_scene_activate', {'scene': self._id})

    def update_info(self, scene_info):
        """Update the scene's information."""
        self._name = scene_info.get('name', self._name)
        self._icon = scene_info.get('icon', self._icon)
        self.async_write_ha_state()

    async def async_added_to_hass(self):
        """When entity is added to Home Assistant."""
        self.async_on_remove(
            self.hass.bus.async_listen('zcc_health_status_updated', self._handle_health_update)
        )

    @callback
    def _handle_health_update(self, event):
        """React to health status updates."""
        self.async_schedule_update_ha_state(True)
