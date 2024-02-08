from homeassistant.components.scene import Scene
from . import DOMAIN
import logging

_LOGGER = logging.getLogger(__name__)

class ZccScene(Scene):
    def __init__(self, hass, api, scene_info):
        """Initialize the scene."""
        self.hass = hass
        self._api = api
        self._id = scene_info['id']
        self._name = scene_info['name']
        self._icon = scene_info.get('icon')

    @property
    def name(self):
        """Return the name of the scene."""
        return self._name

    @property
    def icon(self):
        """Return the icon of the scene if any."""
        return self._icon

    @property
    def available(self):
        return self.hass.data[DOMAIN].get('health_status', False)

    async def async_activate(self):
        """Activate the scene."""
        _LOGGER.info(f"Activating scene: {self._name}")
        await self._api.activate_scene(self._id)

async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Set up the ZCC scene platform."""
    if discovery_info is None:
        return
    api = hass.data[DOMAIN]['api']
    scenes_data = await api.list_scenes()
    if scenes_data is None:
        return
    scenes = [ZccScene(hass, api, scene) for scene in scenes_data['scenes']]
    async_add_entities(scenes, True)
