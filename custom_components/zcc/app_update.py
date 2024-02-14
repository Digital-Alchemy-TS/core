import logging
from homeassistant.components.update import UpdateEntity, UpdateEntityFeature
from homeassistant.core import HomeAssistant, Event
from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)
# https://developers.home-assistant.io/docs/core/entity/update


class CustomUpdateEntity(UpdateEntity):
    """Custom Update Entity tracking hash for updates."""

    def __init__(self, hass: HomeAssistant, app: str, initial_hash: str):
        """Initialize the update entity."""
        self.hass = hass
        self._app = app
        self._name = f"{app} entity updates available"
        self._current_hash = initial_hash
        self._latest_hash = initial_hash
        self._state = None

    @property
    def name(self):
        """Return the name of the update entity."""
        return self._name

    @property
    def title(self):
        """Return the name of the update entity."""
        return self._app

    @property
    def should_poll(self) -> bool:
        """Disable polling."""
        return False

    @property
    def available(self) -> bool:
        """Return True if entity is available."""
        return True

    @property
    def supported_features(self) -> int:
        """Flag supported features."""
        return UpdateEntityFeature.INSTALL

    @property
    def current_version(self):
        """Return the current version."""
        return self._current_hash

    @property
    def latest_version(self):
        """Return the latest version."""
        return self._latest_hash

    @property
    def entity_picture(self):
        """Return an entity picture, if any."""
        return None

    def update_current_hash(self, new_hash: str):
        """Update the current hash and check for availability of updates."""
        self._current_hash = new_hash
        self.async_write_ha_state()

    def update_latest_hash(self, new_hash: str):
        """Manually update the latest hash to simulate an available update."""
        self._latest_hash = new_hash
        if self._latest_hash != self._current_hash:
            self._state = "Update Available"
        else:
            self._state = "Up-to-date"
        self.async_write_ha_state()

    async def async_install(self, **kwargs):
        """Mock install method to handle update action."""
        _LOGGER.info(f"Installing update for {self._name}")
        # Simulate update installation by setting current hash to latest
        self._current_hash = self._latest_hash
        self._state = "Up-to-date"
        self.async_write_ha_state()

        # Optionally, trigger a reload_all event or similar action
        # self.hass.bus.async_fire(f"{DOMAIN}.reload_all")
